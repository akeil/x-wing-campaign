/*
 * This is mounted by the main (`app.js`)
 * under '/api'.
 *
 * Enpoints:
 *
 * Object   | URL                         | Methods
 * ---------|-----------------------------|-------------------
 * User     | `/api/users                 | GET
 * User     | `/api/user/<id>             | GET, PUT, DELETE
 * Campaign | `/api/campaigns/<user>`     | GET
 * Campaign | `/api/campaign/<id>`        | GET, PUT, DELETE
 * Pilot    | `/api/campaign/<id>/pilots` | GET
 * Pilot    | `/api/pilot/<id>`           | GET, PUT, DELETE
 * ShipType | `/api/shiptypes`            | GET
 * ShipType | `/api/shiptype/<id>`        | GET, PUT, DELETE
 * Upgrade  | `/api/upgrades`             | GET
 * Upgrade  | `/api/upgrade/<id>`         | GET, PUT, DELETE
 */

var express = require('express'),
    bodyParser = require('body-parser'),
    store = require('./store'),
    model = require('../common/model');


var api = express();
api.set('json spaces', 2);
api.on('mount', function(parent){
    console.log('api mounted at ' + api.mountpath);
});


// parse JSON request body
api.use(bodyParser.json());

//catch-all error handler
api.use(function(err, req, res, next){
    console.log('Error');
    console.log(err);
    res.status(500);
    res.json({error: err});
});


// User -----------------------------------------------------------------------


/*
 * List user names
 */
api.get('/users', function(req, res){
    fields = ['name', 'displayName'];
    store.users.select({}, fields).then(function(usernames){
        res.json(usernames);
    }).except(function(err){
        res.status(500);
        res.json({error: err});
    });
});


/*
 * GET a single user by user name
 */
api.get('/user/:username', function(req, res){
    var username = req.params.username;
    console.log('GET user ' + username);
    store.users.findOne({name: username}).then(function(user){
        res.json(user);
    }).except(function(err){
        res.json(err);
    });
});

/*
 * Create a user with the given username
 */
api.put('/user/:username', function(req, res){
    var username = req.params.username;
    var user = new model.User(req.body);
    user.name = username;
    //TODO validate
    store.users.put(user).then(function(insertedIds){
        res.json({id: insertedIds[0]});
    }).except(function(err){
        res.status(500);
        res.json({error: err});
    });
});

api.delete('/user/:username', function(req, res){
    var username = req.params.username;
    console.log('DELETE user ' + username);
    store.users.findOne({name: username}).then(function(user){
        store.users.delete(user._id).then(function(result){
            res.json({});
        }).except(function(err){
            res.json(err);
        });
    }).except(function(err){
        res.json(err);
    });
});

// Campaign -------------------------------------------------------------------


/*
 * List campaigns for a user (by username)
 */
api.get('/campaigns/:username', function(req, res){
    var username = req.params.username;
    console.log('GET campaigns for ' + username);
    var fields = ['displayName', 'owner'];
    store.campaigns.select({owner: username}, fields).then(function(campaigns){
        res.json(campaigns);
    }).except(function(err){
        res.status(500);
        res.json({error: err});
    });
});


/*
 * Create a new campaign with the given username as the owner
 */
api.post('/campaigns/:username', function(req, res){
    var username = req.params.username;

    store.users.findOne({name: username}).then(function(user){
        var campaign = new model.Campaign(req.body);
        campaign.owner = username;
        store.campaigns.put(campaign).then(function(insertedIds){
            res.json({id: insertedIds[0]});
        }).except(function(err){
            res.json(err);
        });
    }).except(function(err){
        res.json(err);
    });
});


/*
 * GET a single campaign by id
 */
api.get('/campaign/:campaignid', function(req, res){
    var campaignid = req.params.campaignid;
    // TODO check current user is owner or member

    console.log('GET campaign ' + campaignid);
    store.campaigns.get(campaignid).then(function(campaign){
        res.json(campaign);
    }).except(function(err){
        res.json(err);
    });
});


/*
 * Delete a new campaign
 */
api.delete('/campaign/:campaignid', function(req, res){
    var campaignid = req.params.campaignid;
    // TODO check current user is owner
    console.log('DELETE campaign ' + campaignid);
    store.campaigns.delete(campaignid).then(function(result){
        // no result
        res.json({});
    }).except(function(err){
        res.json(err);
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
        res.json(err);
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
    console.log('Create pilot for campaign ' + campaignid);
    var pilot = new model.Pilot(req.body);
    pilot.campaignid = campaignid;
    // TODO validate callsign + owner is set
    // TODO validate current user is campaign owner
    // TODO validate pilot.owner is not already in the campaign?
    // TODO validate that pilot's campaign props are reset?
    store.pilots.put(pilot).then(function(insertedIds){
        res.json({id: insertedIds[0]});
    }).except(function(err){
        res.json(err);
    });
});


/*
 * Get a pilot by id
 */
api.get('/pilot/:pilotid', function(req, res){
    var pilotid = req.params.pilotid;
    console.log('GET pilot ' + pilotid);
    // TODO check that current user is campaign member
    store.pilots.get(pilotid).then(function(pilot){
        res.json(pilot);
    }).except(function(err){
        res.json(err);
    });
});


/*
 * Delete a pilot by id
 */
api.delete('/pilot/:pilotid', function(req, res){
    var pilotid = req.params.pilotid;
    console.log('DELETE pilot ' + pilotid);
    store.pilots.delete(pilotid).then(function(result){
        res.json({});  // no result
    }).except(function(err){
        res.json(err);
    });
});


// Ships ----------------------------------------------------------------------


/*
 * Get a list of all available ships
 */
api.get('/ships', function(req, res){
    var fields = ['name', 'displayName', 'requiredSkill'];
    store.ships.select(null, fields).then(function(ships){
        res.json(ships);
    }).except(function(err){
        res.json(err);
    });
});

//TODO ships by skill level?

api.get('/ship/:shipname', function(req, res){
    var shipname = req.params.shipname;
    console.log('GET ship ' + shipname);
    store.ships.findOne({name: shipname}).then(function(ship){
        res.json(ship);
    }).except(function(err){
        res.json(err);
    });
});


// Exports --------------------------------------------------------------------


module.exports = function(){
    return api;
};
