var apiclient = require('./apiclient'),
    model = require('../common/model'),
    prom = require('../common/promise');

var $ = require('jquery');
window.jQuery = $;  // jQueryUI expects this to be set
var jqueryui = require('jqueryui');
var Mustache = require('mustache');


// Signals --------------------------------------------------------------------


var EVT_USER_UPDATED        = 'xwing:user-updated';
var EVT_CAMPAIGNS_UPDATED   = 'xwing:campaigns-updated';
var EVT_CAMPAIGN_UPDATED    = 'xwing:campaign-updated';
var EVT_PILOT_UPDATED       = 'xwing:pilot-updated';
var EVT_PILOTS_UPDATED      = 'xwing:pilots-updated';
var EVT_USERS_UPDATED       = 'xwing:users-updated';
var EVT_SHIPS_UPDATED       = 'xwing:ships-updated';

var signal = function(eventName){
    console.log('Signal ' + eventName);
    $(document).trigger(eventName);
};

var onSignal = function(eventName, callback){
    $(document).on(eventName, callback);
};


// Session --------------------------------------------------------------------


Session = function(props){
    this._views = {};
    this.username = props.username;
    this.client = new apiclient.Client();
    this.user = null;
    this.users = null;
    this.campaign = null;
    this.campaigns = null;
    this.pilot = null;
    this.pilots = null;
    this.ships = null;
};

Session.prototype.setup = function(){
    this.client.getUser(this.username).then(function(user){
        this.user = user;
        signal(EVT_USER_UPDATED);
        this.refreshCampaigns();
    }.bind(this));

    this.refreshShips();

    this._views = {
        start: new StartView(this),
        campaign: new CampaignView(this)
    };
};


Session.prototype.show = function(viewName){
    view = this._views[viewName];
    if(view){
        view.load('#view-main');
    }
};

Session.prototype.showCampaign = function(campaignid){
    console.log('show campaign ' + campaignid);
    this.show('campaign');
    this.loadCampaign(campaignid);
};

Session.prototype.deleteCampaign = function(campaignid){
    this.client.deleteCampaign(campaignid).then(function(){
        this.refreshCampaigns();
    }.bind(this));
};

Session.prototype.refreshUsers = function(){
    this.client.getUsers().then(function(users){
        this.users = users;
        signal(EVT_USERS_UPDATED);
    }.bind(this));
};

Session.prototype.refreshCampaigns = function(){
    this.client.getCampaigns(this.user.name).then(function(campaigns){
        this.campaigns = campaigns;
        signal(EVT_CAMPAIGNS_UPDATED);
    }.bind(this));
};

Session.prototype.refreshPilots = function(){
    this.client.getPilots(this.campaign._id).then(function(pilots){
        this.pilots = pilots;
        signal(EVT_PILOTS_UPDATED);

    }.bind(this));
};

Session.prototype.refreshShips = function(){
    this.client.getShips().then(function(ships){
        this.ships = ships;
        signal(EVT_SHIPS_UPDATED);

    }.bind(this));
};

Session.prototype.createCampaign = function(displayName){
    campaign = new model.Campaign({
        displayName: displayName
    });
    this.client.createCampaign(this.user.name, campaign).then(function(){
        this.refreshCampaigns();
    }.bind(this)).except(function(err){
        console.log(err);
    }.bind(this));
};

Session.prototype.createPilot = function(owner, callsign){
        var pilot = new model.Pilot({
            owner: owner,
            callsign: callsign
        });
        this.client.createPilot(this.campaign._id, pilot).then(function(){
            this.refreshPilots();
        }.bind(this));
};

Session.prototype.loadCampaign = function(campaignid){
    this.client.getCampaign(campaignid).then(function(campaign){
        this.campaign = campaign;
        signal(EVT_CAMPAIGN_UPDATED);
        this.refreshPilots();
        this.refreshUsers();

    }.bind(this));
};

Session.prototype.loadPilot = function(pilotid){
    this.client.getPilot(pilotid).then(function(pilot){
        this.pilot = pilot;
        signal(EVT_PILOT_UPDATED);
    }.bind(this));
};



// Views ----------------------------------------------------------------------


_BaseView = function(name, selector, session){
     this.name = name;
     this.selector = selector;
     this.session = session;
     this._template = '';
     this._children = [];

     this.bindSignals();
};

_BaseView.prototype.bindSignals = function(){};

_BaseView.prototype._loadTemplate = function(){
    var promise = new prom.Promise();

    if(this._template !== ''){
        promise.resolve(this._template);
    }else{
        fetchView(this.name).then(function(template){
            this._template = template;
            promise.resolve();
        }.bind(this));
    }
    return promise;
};

_BaseView.prototype.load = function(selector){
    this._loadTemplate().then(function(template){
        console.log('add ' + this.name + ' to ' + selector);
        $(selector).html(this.render());
        this.bindEvents();
        this._loadChildren();
    }.bind(this));
};

_BaseView.prototype._loadChildren = function(){
    for(var i=0; i < this._children.length; i++){
        var selector = '#child-view-' + this._children[i].name;
        this._children[i].load(selector);
    }
};

_BaseView.prototype.getRenderContext = function(){
    return {};
};

_BaseView.prototype.bindEvents = function(){};

_BaseView.prototype.render = function(){
    return Mustache.render(this._template, this.getRenderContext());
};

_BaseView.prototype.refresh = function(){
    console.log('Refresh ' + this.name);
    this._loadTemplate().then(function(template){
        // unbind events?
        $(this.selector).replaceWith(this.render());
        this.bindEvents();
    }.bind(this));
};


// Start View -----------------------------------------------------------------


StartView = function(session){
    _BaseView.call(this, 'start', '#view-start', session);
    this._children.push(new CampaignsView(session));
    this._children.push(new NewCampaignView(session));
};

StartView.prototype = new _BaseView();


// Campaigns View -------------------------------------------------------------


CampaignsView = function(session){
    _BaseView.call(this, 'campaigns', '#view-campaigns', session);
};

CampaignsView.prototype = new _BaseView();

CampaignsView.prototype.bindSignals = function(){
    onSignal(EVT_CAMPAIGNS_UPDATED, this.refresh.bind(this));
};

CampaignsView.prototype.bindEvents = function(){
    // navigation link to open campaign view
    $(this.selector + ' ul li a').each(function(index, a){
        $(a).off('click');
        $(a).on('click', function(evt){
            var campaignid = $(evt.delegateTarget).data("id");
            this.session.showCampaign(campaignid);
        }.bind(this));
    }.bind(this));

    // delete buttons
    $(this.selector + ' li button').each(function(index, button){
        $(button).off('click');
        $(button).on('click', function(evt){
            var campaignid = $(evt.delegateTarget).data("id");
            this.session.deleteCampaign(campaignid);
        }.bind(this));
    }.bind(this));
};

CampaignsView.prototype.getRenderContext = function(){
    return {
        campaigns: this.session.campaigns
    };
};


NewCampaignView = function(session){
    _BaseView.call(this, 'new-campaign', '#view-new-campaign', session);
};

NewCampaignView.prototype = new _BaseView();

_BaseView.prototype.bindEvents = function(){
    $('#campaign-start').off('submit');
    $('#campaign-start').on('submit', function(evt){
        evt.preventDefault();
        var displayName = $('#campaign-displayName').val();
        this.session.createCampaign(displayName);
    }.bind(this));
};


// Campaign View --------------------------------------------------------------


CampaignView = function(session){
    _BaseView.call(this, 'campaign', '#view-campaign', session);
    this._children.push(new PilotsView(session));
    this._children.push(new AddPilotView(session));
    this._children.push(new PilotDetailsView(session));
};

CampaignView.prototype = new _BaseView();

CampaignView.prototype.bindSignals = function(){
    //onSignal(EVT_CAMPAIGN_UPDATED, this.refresh.bind(this));
    //onSignal(EVT_PILOTS_UPDATED, this.refresh.bind(this));
};

CampaignView.prototype.bindEvents = function(){
    //$('#campaign-tabs').tabs('destroy');
    $('#campaign-tabs').tabs();
};

CampaignView.prototype.getRenderContext = function(){
    return {
        campaign: this.session.campaign,
        pilots: this.session.pilots
    };
};


// Pilots View ----------------------------------------------------------------


PilotsView = function(session){
    _BaseView.call(this, 'pilots', '#view-pilots', session);
};

PilotsView.prototype = new _BaseView();

PilotsView.prototype.bindSignals = function(){
    onSignal(EVT_PILOTS_UPDATED, this.refresh.bind(this));
};

PilotsView.prototype.bindEvents = function(){
    $(this.selector + ' li a').each(function(index, a){
        $(a).off('click');
        $(a).on('click', function(evt){
            evt.preventDefault();
            var pilotid = $(evt.delegateTarget).data('id');
            this.session.loadPilot(pilotid);

        }.bind(this));
    }.bind(this));
};

PilotsView.prototype.getRenderContext = function(){
    return {
        pilots: this.session.pilots
    };
};


// Add Pilot ------------------------------------------------------------------


AddPilotView = function(session){
    _BaseView.call(this, 'add-pilot', '#view-add-pilot', session);
};

AddPilotView.prototype = new _BaseView();

AddPilotView.prototype.bindSignals = function(){
    onSignal(EVT_USERS_UPDATED, this.refresh.bind(this));
};

AddPilotView.prototype.bindEvents = function(){
    $('#add-pilot').off('submit');
    $('#add-pilot').on('submit', function(evt){
        evt.preventDefault();
        var owner = $('#pilot-owner').val();
        var callsign = $('#pilot-callsign').val();
        this.session.createPilot(owner, callsign);
    }.bind(this));
};

AddPilotView.prototype.getRenderContext = function(){
    return {
        users: this.session.users
    };
};


// Pilot Details --------------------------------------------------------------


PilotDetailsView = function(session){
    _BaseView.call(this, 'pilot-details', '#view-pilot-details', session);
};

PilotDetailsView.prototype = new _BaseView();

PilotDetailsView.prototype.bindSignals = function(){
    onSignal(EVT_PILOT_UPDATED, this.refresh.bind(this));
    onSignal(EVT_SHIPS_UPDATED, this.refresh.bind(this));
};

PilotDetailsView.prototype.bindEvents = function(){

};

PilotDetailsView.prototype.getRenderContext = function(){
    return {
        pilot: this.session.pilot,
        ships: this.session.ships
    };
};


// ----------------------------------------------------------------------------

var fetchView = function(viewName){
    var promise = new prom.Promise();

    $.ajax({
        url: 'snippets/' + viewName + '.html'
    }).done(function(content){
        promise.resolve(content);
    });

    return promise;
};


var login = function(){
    return new Session({username: 'akeil'});
};


var main = function(){
    var session = login();
    session.setup();
    session.show('start');
};

$(main);
