/*
 * This module is responsible for login, authentication and session management.
 *
 * It provides a HTTP handler to serve login-requests and initialize a session.
 * The HTTP handler is at:
 * ```
 * POST <mountpoint>/login/<username>
 * ```
 *
 * The auth module also exports a *middleware* function `authenticate()`
 * which can be used to check authentication for requests.
 *
 * Sessions are stored in the database in a collection named `sessions`.
 * The module expects a second DB collection named `users` where each user
 * has a unique `name` and a `pwHash` attribute.
 *
 */
var express = require('express'),
    bodyParser = require('body-parser'),
    bcrypt = require('bcrypt'),
    crypto = require('crypto'),
    store = require('./store'),
    prom = require('../common/promise'),
    errors = require('../common/errors');


var SESSION_COOKIE = 'session';
var AUTH_HEADER = 'X-Auth-Token';


/*
 * Checks whether the given username and password are valid and if valid,
 * creates a new session for the user.
 *
 * Returns a *Promise* on the *Session* object.
 */
var login = function(username, password){
    var promise = new prom.Promise();
    store.users.findOne({name: username}).then(function(user){
        bcrypt.compare(password, user.pwHash, function(err, matches){
            if(err){
                console.log(err);
                promise.fail(errors.serviceError('authentication error'));
            }else if(matches !== true){
                promise.fail(errors.badPassword());
            } else {
                // that's a valid password, create a session
                var session = {
                    user: user.name,
                    token: crypto.randomBytes(16).toString('hex'),
                    csrfToken: crypto.randomBytes(16).toString('hex'),
                    expires: new Date().getTime() + (1000 * 60 * 60 * 24)
                };
                store.sessions.put(session).then(function(sessionId){
                    console.log('Created session ' + sessionId + ' for ' + user.name);
                    promise.resolve(session);
                }).except(function(err){
                    promise.fail(errors.serviceError('failed to store session'));
                });
            }
        });
    }).except(function(err){
        // the user does not exist
        promise.fail(err);
    });

    return promise;
};


/*
 * Middelware function to authenticate requests.
 * Checks if the requests belongs to a valid session and if so, sets
 * ```
 * req.user = user;        // User object
 * req.session = session;  // Session object
 * ```
 *
 * If the session is not valid, the request is aborted and
 * answered with `HTTP 401 - Unauthorized`.
 */
var authenticate = function(req, res, next){
    var token, csrfToken;
    if(req.cookies){
        token = req.cookies[SESSION_COOKIE];
    }
    csrfToken = req.get(AUTH_HEADER);

    if(!token || !csrfToken){
        console.log('No session token from cookie.');
        sendError(res, errors.unauthorized('Missing authentication token'));
        return;
    }

    var predicate = {token: token, csrfToken: csrfToken};
    store.sessions.findOne(predicate).then(function(session){

        var expires = session.expires || 0;
        var ts = new Date().getTime();
        if( expires < ts){
            console.log('Session for ' + session.user + ' is expired');
            sendError(res, errors.unauthorized('Session expired'));
            return;
        }

        store.users.findOne({name: session.user}).then(function(user){
            console.log('Session ' + session._id + ' for user ' + user.name);
            req.session = session;
            req.user = user;
            next();
        }).except(function(err){
            console.log('User not found');
            sendError(res, errors.unauthorized('invalid session'));
        });
    }).except(function(err){
        console.log('Could not load session');
        sendError(res, errors.unauthorized('invalid session'));
    });
};


var setPassword = function(user, password){
    var promise = prom.Promise();

    bcrypt.hash(password, 10, function(err, hash){
        if(!err){
            user.pwHash = hash;
            // TODO set pwExpires and pwMustValidate
            promise.resolve(user);
        }else{
            promise.fail(errors.serviceError());
        }
    });

    return promise;
};


var sendError = function(res, err){
    console.error(err);
    res.status(err.code || 500).json({
        name: err.name || 'ServiceError',
        message: err.message || 'Error handling request'
    });
};


var auth = express();

auth.use(bodyParser.json());


/*
 * Initialize a new Session for the given user.
 * Expects a JSON body with the clear password:
 * ```
 * {"password": "secret"}
 * ```
 *
 * Returns a JSON response with the CSRF token:
 * ```
 * {"token": "abcd"}
 * ```
 *
 * And a `Set-Cookie` header with the session token:
 * ```
 * Set-Cookie: session=<session-token>; path=/; expires=<Date+Time>; httponly
 * ```
 */
auth.post('/login/:username', function(req, res){
    var username = req.params.username;
    var password = req.body.password;
    if(!username || !password){
        sendError(res, errors.invalid('missing username or password'));
    }else{
        login(username, password).then(function(session){
            res.cookie(SESSION_COOKIE, session.token, {
                expires: new Date(session.expires * 1000),
                httpOnly: true
            });
            res.json({
                token: session.csrfToken
            });
        }).except(function(err){
            sendError(res, err);
        });
    }
});

/*
 * Logout from an existing session
 */
auth.use('/logout', authenticate);
auth.post('/logout', function(req, res){
    store.sessions.delete(req.session._id, req.session.version).then(function(){
        console.log('Logout ' + req.user.name + ' from ' + req.session._id);
        res.clearCookie(SESSION_COOKIE);
        res.status(200);
        res.json({});
    }).except(function(err){
        sendError(res, err);
    });
});


module.exports.app = auth;
module.exports.authenticate = authenticate;
module.exports.setPassword = setPassword;
