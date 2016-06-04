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
    login(username, password).then(function(session){
        res.cookie('session', session.token, {
            expires: new Date(session.expires * 1000),
            httpOnly: true
        });
        res.json({
            token: session.csrfToken
        });
    }).except(function(err){
        sendError(res, err); // TODO
    });
});


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
                //  TODO proper error class
                console.log(err);
                promise.fail(err);
            }else if(matches !== true){
                promise.fail(errors.badPassword());
            } else {
                // that's a valid password, create a session
                var session = {
                    user: user.name,
                    token: crypto.randomBytes(16).toString('hex'),
                    csrfToken: crypto.randomBytes(16).toString('hex'),
                    expires: new Date().getTime() + (60 * 60 * 24)
                };
                store.sessions.put(session).then(function(sessionId){
                    console.log('Created session for ' + user.name);
                    promise.resolve(session);
                }).except(function(err){
                    // TODO proper error class
                    promise.fail(errors.forbidden('failed to store session'));
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
 * If the session is not valid, the request is aborted.
 */
var authenticate = function(req, res, next){
    var token, csrfToken;
    csrfToken = req.get('X-Auth-Token');
    if(!csrfToken){
        console.log('No CSRF token in HTTP header.');
        // exit
    }

    if(req.cookies){
        token = req.cookies.session;
    }
    if(!token){
        console.log('No session token from cookie.');
        // exit
    }

    var predicate = {token: token, csrfToken: csrfToken};
    store.sessions.findOne(predicate).then(function(session){
        console.log('Found session ' + session._id);
        // check if expired
        store.users.findOne({name: session.user}).then(function(user){
            console.log('Session for user ' + user.name);
            req.session = session;
            req.user = user;
            next();
        }).except(function(err){
            console.log(err);
            console.log('User not loaded.');
            next();  //  TODO: end
        });
    }).except(function(err){
        console.log('Could not load session');
        console.log(err);
        next();  //  TODO: end
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

module.exports.app = auth;
module.exports.authenticate = authenticate;
module.exports.setPassword = setPassword;
