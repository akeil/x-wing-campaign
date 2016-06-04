/*
 * Client for the REST+JSON webservice.
 *
 * The `Client` class provides methods that wrap the calls to the individual
 * service enpoints.
 * The service methods will generally work with instances of the `model.*`
 * classes.
 *
 * Calls are made asynchronously and a `Promise` is returned for each call.
 */
var prom = require('../common/promise'),
    model = require('../common/model'),
    errors = require('../common/errors');
var $ = require('jquery');


Client = function(username){
    this.username = username;
    this.apiURL = '/api';
    this.authURL = '/auth';
    this._token = null;
};


var arrayOf = function(factory){
    return function(items){
        results = [];
        for(var i=0; i < items.length; i++){
            results.push(factory(items[i]));
        }
        return results;
    };
};

// Authentication -------------------------------------------------------------

Client.prototype.login = function(password){
    var promise = new prom.Promise();

    this._request({
        url: this.authURL + '/login/' + this.username,
        method: 'POST',
        auth: false,
        payload: {password: password}
    }).then(function(result){
        this._token = result.token;
        promise.resolve();
    }.bind(this)).except(function(err){
        promise.fail(err);
    });

    return promise;
};

Client.prototype.logout = function(){
    var promise = new prom.Promise();

    this._request({
        url: this.authURL + '/logout',
        method: 'POST'
    }).then(function(result){
        this._token = null;
        promise.resolve();
    }.bind(this)).except(function(err){
        promise.fail(err);
    });

    return promise;
};

// User -----------------------------------------------------------------------

Client.prototype.getUser = function(){
    return this._GET({
        endpoint: '/user/' + this.username,
        wrap: model.NewUser
    });
};

Client.prototype.getUsers = function(){
    return this._GET({
        endpoint: '/users',
        wrap: arrayOf(model.NewUser)
    });
};


// Campaign -------------------------------------------------------------------

Client.prototype.getCampaigns = function(){
    return this._GET({
        endpoint: '/campaigns/' + this.username,
        wrap: arrayOf(model.NewCampaign)
    });
};

Client.prototype.getCampaign = function(campaignid){
    return this._GET({
        endpoint: '/campaign/' + campaignid,
        wrap: model.NewCampaign
    });
};

Client.prototype.createCampaign = function(campaign){
    return this._POST({
        endpoint: '/campaigns/' + this.username,
        payload: campaign
    });
};

Client.prototype.updateCampaign = function(campaign){
    return this._PUT({
        endpoint: '/campaign/' + campaign._id,
        payload: campaign
    });
};

Client.prototype.deleteCampaign = function(campaignid){
    return this._DELETE({
        endpoint: '/campaign/' + campaignid
    });
};

// Pilot ----------------------------------------------------------------------

Client.prototype.getPilots = function(campaignid){
    return this._GET({
        endpoint: '/campaign/' + campaignid + '/pilots',
        wrap: arrayOf(model.NewPilot)
    });
};

Client.prototype.getPilot = function(pilotid){
    return this._GET({
        endpoint: '/pilot/' + pilotid,
        wrap: model.NewPilot
    });
};

Client.prototype.createPilot = function(campaignid, pilot){
    return this._POST({
        endpoint: '/campaign/' + campaignid + '/pilot',
        payload: pilot
    });
};

Client.prototype.updatePilot = function(pilot){
    return this._PUT({
        endpoint: '/pilot/' + pilot._id,
        payload: pilot
    });
};

Client.prototype.deletePilot = function(pilotid){
    return this._DELETE({
        endpoint: '/pilot/' + pilotid
    });
};

// Ship -----------------------------------------------------------------------

Client.prototype.getShips = function(campaignid){
    return this._GET({
        endpoint: '/ships',
        wrap: arrayOf(model.NewShip)
    });
};

Client.prototype.getShip = function(name){
    return this._GET({
        endpoint: '/ship/' + name,
        wrap: model.NewShip
    });
};

// Mission -----------------------------------------------------------------------

Client.prototype.getMissions = function(campaignid){
    return this._GET({
        endpoint: '/missions',
        wrap: arrayOf(model.NewMission)
    });
};

Client.prototype.getMission = function(name){
    return this._GET({
        endpoint: '/mission/' + name,
        wrap: model.NewMission
    });
};

// Helpers --------------------------------------------------------------------

Client.prototype._GET = function(p){
    p.method = 'GET';
    p.url = this.apiURL + p.endpoint;
    return this._request(p);
};

Client.prototype._POST = function(p){
    p.method = 'POST';
    p.url = this.apiURL + p.endpoint;
    return this._request(p);
};

Client.prototype._PUT = function(p){
    p.method = 'PUT';
    p.url = this.apiURL + p.endpoint;
    return this._request(p);
};

Client.prototype._DELETE = function(p){
    p.method = 'DELETE';
    p.url = this.apiURL + p.endpoint;
    return this._request(p);
};

Client.prototype._request = function(p){
    var url = p.url;
    var method = p.method;
    var payload = p.payload || null;
    var wrap = p.wrap || identity;
    var auth = p.auth === false ? false : true;
    var headers = {};

    var promise = new prom.Promise();

    if(auth && !this._token){
        promise.fail(errors.unauthorized('Not logged in'));
        return promise;
    }else if(auth){
        headers = {
            'X-Auth-Token': this._token
        };
    }

    if(payload){
        payload = JSON.stringify(payload);
    }

    $.ajax({
        url: url,
        type: method,
        headers: headers,
        dataType: 'json',  // for response
        data: payload,
        contentType: 'application/json'

    }).done(function(jsonResponse){
        promise.resolve(wrap(jsonResponse));

    }).fail(function(xhr, status, err){
        var name, message;
        if(xhr.responseJSON){
            name = xhr.responseJSON.name;
            message = xhr.responseJSON.message;
        }
        var code = xhr.status;
        name = name || 'ServiceError';
        message = message || status;
        promise.fail(new errors.Exception(code, name, message));

    }).always(function(xhr, status){
        console.log('Got HTTP ' + xhr.status + ' for ' + method + ' ' + url);
    });

    return promise;
};


var identity = function(arg){
    return arg;
};


exports.Client = Client;
