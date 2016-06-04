/*
 * This is mounted by the main (`app.js`)
 * under '/api'.
 *
 * Enpoints:
 *
 * Object   | URL                         | Methods
 * ---------|-----------------------------|-------------------
 * User     | `/api/users                 | GET
 * User     | `/api/user/<name>           | GET, PUT, DELETE
 * User     | `/api/user/<name>/login     | POST
 * Campaign | `/api/campaigns/<user>`     | GET
 * Campaign | `/api/campaign`             | POST
 * Campaign | `/api/campaign/<id>`        | GET, PUT, DELETE
 * Pilot    | `/api/campaign/<id>/pilots` | GET
 * Pilot    | `/api/pilot/<id>`           | GET, PUT, DELETE
 * Ship     | `/api/ships`                | GET
 * Ship     | `/api/ship/<name>`          | GET
 * Mission  | `/api/missions`             | GET
 * Mission  | `/api/missions/initial`     | GET
 * Mission  | `/api/mission/<name>`       | GET
 * Upgrade  | `/api/upgrades`             | GET
 * Upgrade  | `/api/upgrade/<id>`         | GET, PUT, DELETE
 *
 * All request are expected to contain a body in JSON format (or none).
 * All responses will be JSON (or empty).
 *
 * Errors are returned as an HTTP status code and with an error object
 * in the response body:
 * ```
 * {
 *    "name": "NameOfError",
 *    "message": "An error message"
 * }
 * ```
 */
var express = require('express'),
    bodyParser = require('body-parser'),
    bcrypt = require('bcrypt'),
    crypto = require('crypto'),
    store = require('./store'),
    errors = require('../common/errors'),
    model = require('../common/model');


var api = express();
api.set('json spaces', 2);
api.on('mount', function(parent){
    console.log('api mounted at ' + api.mountpath);
});


// parse JSON request body
api.use(bodyParser.json());
/*
//catch-all error handler
api.use(function(err, req, res, next){
    console.log('Error');
    console.log(err);
    res.status(500);
    res.json({error: err});
});
*/
// log every request
api.use('/', function(req, res, next){
    console.log(req.method + ' ' + req.originalUrl);
    next();
});


/*
 * Create an error object from the given error
 * and write it as a JSON object to the response.
 *
 * Also, set the appropriate HTTP code.
 *
 * The `err` argument is ideally an instance of `errors.Exception`
 * but other error types can also be passed in.
 */
var sendError = function(res, err){
    console.log(err);
    res.status(err.code || 500);
    res.json({
        name: err.name || 'ServiceError',
        message: err.message || 'Error handling request'
    });
};


// User -----------------------------------------------------------------------


/*
 * List user names
 */
// TODO pagination
api.get('/users', function(req, res){
    fields = ['name', 'displayName'];
    store.users.select({}, fields).then(function(usernames){
        res.json(usernames);
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * GET a single user by user name
 */
api.get('/user/:username', function(req, res){
    var username = req.params.username;
    store.users.findOne({name: username}).then(function(user){
        delete user.pwHash;
        res.json(user);
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Create a new user with the given username.
 * Expects a `model.User` in the request body.
 *
 * Additionally, the users clear password should be set in the JSON body:
 * ```
 * {
 *   "displayName": "John Doe",
 *   "password": "secret"
 * }
 * ```
 */
api.put('/user/:username', function(req, res){
    // TODO check permission "admin"

    var username = req.params.username;
    var user = new model.User(req.body);
    var password = req.body.password;
    user.name = username;

    try{
        user.validate();
    }catch(err){
        sendError(res, err);
        return;
    }

    bcrypt.hash(password, 10, function(err, hash){
        if(!err){
            user.pwHash = hash;
            // TODO set pwExpires and pwMustValidate
            store.users.put(user).then(function(insertedId){
                res.json({id: insertedId});
            }).except(function(err){
                sendError(res, err);
            });
        }else{
            sendError(res, errors.serviceError());
        }
    });

});

/*
 * Delete the user with the given username.
 */
api.delete('/user/:username', function(req, res){
    var username = req.params.username;
    // TODO check permission "admin"
    store.users.findOne({name: username}).then(function(user){
        store.users.delete(user._id).then(function(result){
            res.json({});
        }).except(function(err){
            sendError(res, err);
        });
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Initialize a new Session for the given user.
 * Expects a JSON body with the clear password:
 * ```
 * {"password": "secret"}
 * ```
 *
 * Returns a JSON response with tthe CSRF token:
 * ```
 * {"token": "abcd"}
 * ```
 * And a `Set-Cookie` header with the session token:
 * ```
 * Set-Cookie: session=<session-token>; path=/; expires=<Date+Time>; httponly
 * ```
 */
api.post('/user/:username/login', function(req, res){
    var username = req.params.username;
    var password = req.body.password;

    store.users.findOne({name: username}).then(function(user){
        bcrypt.compare(password, user.pwHash, function(err, matches){
            if(err){
                //  TODO proper error class
                console.log(err);
                sendError(res, errors.forbidden('error comparing pw'));
            }else if(matches !== true){
                sendError(res, errors.badPassword());
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
                    res.cookie('session', session.token, {
                        expires: new Date(session.expires * 1000),
                        httpOnly: true
                    });
                    res.json({
                        token: session.csrfToken
                    });
                }).except(function(err){
                    // TODO proper error class
                    sendError(errors.forbidden('failed to store session'));
                });
            }
        });
    }).except(function(err){
        // the user does not exist
        sendError(res, err);
    });
});


// Campaign -------------------------------------------------------------------


/*
 * List campaigns for a user (by username)
 */
api.get('/campaigns/:username', function(req, res){
    var username = req.params.username;
    // TODO check permission
    var fields = ['displayName', 'owner'];
    store.campaigns.select({owner: username}, fields).then(function(campaigns){
        res.json(campaigns);
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Create a new campaign with the given username as the owner.
 * Expects a `model.Campaign` in the request body.
 */
api.post('/campaigns/:username', function(req, res){
    var username = req.params.username;
    // TODO check permission (user == owner)
    store.users.findOne({name: username}).then(function(user){
        var campaign = new model.Campaign(req.body);
        campaign.owner = username;

        try{
            campaign.validate();
        }catch(err){
            sendError(res, err);
            return;
        }

        // setup campaign
        var fields = ['name'];
        var predicate = {startingMission: true};
        store.missions.select(predicate, fields).then(function(items){
            for(var i = 0; i < items.length; i++) {
                campaign.unlockMission(items[i].name);
            }

            store.campaigns.put(campaign).then(function(insertedId){
                res.json({id: insertedId});
            }).except(function(err){
                sendError(res, err);
            });

        }).except(function(err){
            sendError(res, err);
        });

    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * GET a single campaign by id
 */
api.get('/campaign/:campaignid', function(req, res){
    var campaignid = req.params.campaignid;
    // TODO check current user is owner or member

    store.campaigns.get(campaignid).then(function(campaign){
        res.json(campaign);
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Save a single campaign
 */
api.put('/campaign/:campaignid', function(req, res){
    var campaignid = req.params.campaignid;

    // TODO load the current instance ?
    // TODO check current user is owner
    var campaign = new model.Campaign(req.body);
    campaign._id = campaignid;

    try{
        campaign.validate();
    }catch(err){
        sendError(res, err);
        return;
    }

    store.campaigns.put(campaign).then(function(){
        res.json({});
    }).except(function(err){
        sendError(res, err);
    });
});


/*
 * Delete a campaign.
 * Expects a `model.Campaign` in the request body.
 */
api.delete('/campaign/:campaignid', function(req, res){
    var campaignid = req.params.campaignid;
    // TODO check current user is owner
    store.campaigns.delete(campaignid).then(function(result){
        // no result
        res.json({});
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * List pilots for a campaign
 */
api.get('/campaign/:campaignid/pilots', function(req, res){
    var campaignid = req.params.campaignid;
    // check current user is campaign member
    var fields = ['owner', 'callsign'];
    store.pilots.select({campaignid: campaignid}, fields).then(function(pilots){
        res.json(pilots);
    }).except(function(err){
        sendError(res, err);
    });
});


// Pilot ----------------------------------------------------------------------


/*
 * Create a new pilot for a campaign.
 * The request body must contain:
 * {
 *  "owner": <username-of-owner>
 *  "callsign": <callsign-for-pilot>
 + }
 */
api.post('/campaign/:campaignid/pilot', function(req, res){
    var campaignid = req.params.campaignid;
    var pilot = new model.Pilot(req.body);
    pilot.campaignid = campaignid;

    try{
        pilot.validate();
    }catch(err){
        sendError(res, err);
        return;
    }

    // TODO validate that the campaign exists
    // TODO validate current user is campaign owner
    // TODO validate pilot.owner is not already in the campaign?
    // TODO validate that pilot's campaign props are reset?
    store.pilots.put(pilot).then(function(insertedId){
        res.json({id: insertedId});
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Get a pilot by id
 */
api.get('/pilot/:pilotid', function(req, res){
    var pilotid = req.params.pilotid;
    // TODO check that current user is campaign member
    store.pilots.get(pilotid).then(function(pilot){
        res.json(pilot);
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Delete a pilot by id
 */
api.delete('/pilot/:pilotid', function(req, res){
    var pilotid = req.params.pilotid;
    // TODO validate user is owner or campaign owner
    store.pilots.delete(pilotid).then(function(result){
        res.json({});  // no result
    }).except(function(err){
        sendError(res, err);
    });
});


// Ship -----------------------------------------------------------------------


/*
 * Get a list of all available ships
 */
api.get('/ships', function(req, res){
    var fields = ['name', 'displayName', 'requiredSkill'];
    store.ships.select(null, fields).then(function(ships){
        res.json(ships);
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Get details for a single ship by name
 */
api.get('/ship/:shipname', function(req, res){
    var shipname = req.params.shipname;
    store.ships.findOne({name: shipname}).then(function(ship){
        res.json(ship);
    }).except(function(err){
        sendError(res, err);
    });
});


// Mission --------------------------------------------------------------------


/*
 * Get a list of all available missions
 */
api.get('/missions', function(req, res){
    var fields = ['name', 'displayName'];
    store.missions.select(null, fields).then(function(items){
        res.json(items);
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Get a list of all *starting* missions
 */
api.get('/missions/initial', function(req, res){
    var fields = ['name', 'displayName'];
    var predicate = {startingMission: true};
    store.missions.select(predicate, fields).then(function(items){
        res.json(items);
    }).except(function(err){
        sendError(res, err);
    });
});

/*
 * Get details for a single mission by name
 */
api.get('/mission/:missionname', function(req, res){
    var missionname = req.params.missionname;
    store.missions.findOne({name: missionname}).then(function(item){
        res.json(item);
    }).except(function(err){
        sendError(res, err);
    });
});


// Exports --------------------------------------------------------------------


module.exports = function(){
    return api;
};
