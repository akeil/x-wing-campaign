var prom = require('../common/promise'),
    model = require('../common/model');
var $ = require('jquery');


/*
 * API client
 */
Client = function(){
    this.baseurl = '/api';
};

// User -----------------------------------------------------------------------

Client.prototype.getUser = function(username){
    return this._GET({
        endpoint: '/user/' + username,
        wrap: function(data){
            return new model.User(data);
        }
    });
};

// Campaign -------------------------------------------------------------------

Client.prototype.getCampaigns = function(username){
    return this._GET({
        endpoint: '/campaigns/' + username,
        wrap: function(campaigns){
            results = [];
            for(var i=0; i < campaigns.length; i++){
                results.push(new model.Campaign(campaigns[i]));
            }
            return results;
        }
    });
};

Client.prototype.getCampaign = function(campaignid){
    return this._GET({
        endpoint: '/campaign/' + campaignid,
        wrap: function(data){
            return new model.Campaign(data);
        }
    });
};

Client.prototype.createCampaign = function(campaign, username){
    return this._POST({
        endpoint: '/campaigns/' + username,
        payload: campaign
    });
};

// Helpers --------------------------------------------------------------------

Client.prototype._GET = function(p){
    p.method = 'GET';
    return this._promise(p);
};

Client.prototype._POST = function(p){
    p.method = 'POST';
    return this._promise(p);
};

Client.prototype._promise = function(p){
    var url = this.baseurl + p.endpoint;
    var method = p.method;
    var payload = p.payload || null;
    var wrap = p.wrap || identity;

    var promise = new prom.Promise();

    if(payload){
        payload = JSON.stringify(payload);
    }

    $.ajax({
        url: url,
        type: method,
        dataType: 'json',  // for response
        data: payload,
        contentType: 'application/json'
    }).done(function(jsonResponse){
        console.log(jsonResponse);
        promise.resolve(wrap(jsonResponse));
    }).fail(function(xhr, status, err){
        promise.fail({status: status, error: err});
    }).always(function(xhr, status){
        console.log('Got HTTP ' + status + ' for ' + url);
    });

    return promise;
};


var identity = function(arg){
    return arg;
};


exports.Client = Client;
