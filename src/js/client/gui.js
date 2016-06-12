/*
 *
 */
var apiclient = require('./apiclient'),
    model = require('../common/model'),
    prom = require('../common/promise'),
    errors = require('../common/errors');

var $ = require('jquery');
window.jQuery = $;  // jQueryUI expects this to be set
var jqueryui = require('jqueryui');
var Mustache = require('mustache');
require('bootstrap-less/js/bootstrap');


var EVT_MESSAGE_UPDATED         = 'xwing:message-updated';
var EVT_USER_UPDATED            = 'xwing:user-updated';
var EVT_CAMPAIGNS_UPDATED       = 'xwing:campaigns-updated';
var EVT_CAMPAIGN_UPDATED        = 'xwing:campaign-updated';
var EVT_PILOT_UPDATED           = 'xwing:pilot-updated';
var EVT_PILOTS_UPDATED          = 'xwing:pilots-updated';
var EVT_USERS_UPDATED           = 'xwing:users-updated';
var EVT_SHIPS_UPDATED           = 'xwing:ships-updated';
var EVT_UPGRADES_UPDATED        = 'xwing:upgrades-updated';
var EVT_MISSIONS_UPDATED        = 'xwing:missions-updated';
var EVT_MISSION_DETAILS_UPDATED = 'xwing:mission-details-updated';

// levels for error messages, match bootstrap css classes
var LVL_SUCCESS = 'success';
var LVL_INFO    = 'info';
var LVL_WARNING = 'warning';
var LVL_DANGER  = 'danger';

var ARROW_RIGHT = '&#x25ba;';
var ARROW_DOWN  = '&#x25be;';


// Signals --------------------------------------------------------------------


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
    this.client = new apiclient.Client(props.username);
    this.user = null;
    this.users = null;
    this.campaign = null;
    this.campaigns = null;
    this.pilot = null;
    this.pilots = null;
    this.ships = null;
    this.upgrades = null;
    this.upgradeDetails = {};
    this.missions = null;
    this.missionDetails = {};
    this.currentMessage = null;
    this.messageLog = [];
    this.messageTimeoutID = null;
};

Session.prototype.login = function(password){
    this.client.login(password).then(function(){

        this.client.getUser().then(function(user){
            this.user = user;
            signal(EVT_USER_UPDATED);
        }.bind(this));

        this.refreshUsers();
        this.refreshShips();
        this.refreshUpgrades();
        this.refreshMissions();
        this.refreshCampaigns();

        show('#header', new HeaderView(this));
        show('#messages', new MessagesView(this));

        this._views = {
            home: new HomeView(this),
            campaign: new CampaignView(this),
            pilot: new PilotView(this)
        };
        show('#main', this._views.home);  // use this.showHome() instead?

    }.bind(this));
};

Session.prototype.logout = function(){
    this.client.logout().then(function(){
        this.users = null;
        this.campaign = null;
        this.campaigns = null;
        this.pilot = null;
        this.pilots = null;
        this.ships = null;
        this.missions = null;
        this.missionDetails = {};
        show('#main', new WelcomeView());
    }.bind(this)).except(function(err){

    });
};

Session.prototype.showHome = function(){
    // TODO: unload the current campaign
    show('#main', this._views.home);
};

Session.prototype.showPilot = function(pilotid){
    show('#main', this._views.pilot);
    this.loadPilot(pilotid);
};

Session.prototype.showCampaign = function(campaignid){
    console.log('show campaign ' + campaignid);
    show('#main', this._views.campaign);
    this.loadCampaign(campaignid);
};

Session.prototype.message = function(level, text){
    if(this.messageTimeoutID !== null){
        window.clearTimeout(this.messageTimeoutID);
    }
    if(this.currentMessage){
        this.messageLog.splice(0, 0, this.currentMessage);
    }
    this.messageLog.splice(3);  //  keep only n most recent messages
    this.currentMessage = {
        level: level,
        levelText: level.substring(0, 1).toUpperCase() + level.substring(1),
        text: text
    };
    signal(EVT_MESSAGE_UPDATED);

    // make the message disappear later
    this.messageTimeoutID = window.setTimeout(
        this.dismissMessage.bind(this),
        1000 * 7
    );
};

Session.prototype.dismissMessage = function(){
    if(this.currentMessage){
        this.messageLog.splice(0, 0, this.currentMessage);
        this.messageLog.splice(3);  //  keep only n most recent messages
        this.currentMessage = null;
        signal(EVT_MESSAGE_UPDATED);
    }
};

Session.prototype.errorMessage = function(err){
    this.message(LVL_DANGER, err.message);
};

Session.prototype.refreshUsers = function(){
    this.client.getUsers().then(function(users){
        this.users = users;
        signal(EVT_USERS_UPDATED);
    }.bind(this));
};

Session.prototype.refreshCampaigns = function(){
    this.client.getCampaigns().then(function(campaigns){
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

Session.prototype.refreshUpgrades = function(){
    this.client.getUpgrades().then(function(upgrades){
        this.upgrades = upgrades;
        signal(EVT_UPGRADES_UPDATED);

    }.bind(this));
};

Session.prototype.getUpgrade = function(upgradeName){
    var promise = new prom.Promise();
    if(this.upgradeDetails[upgradeName]){
        promise.resolve(this.upgradeDetails[upgradeName]);
    }else{
        this.client.getUpgrade(upgradeName).then(function(upgrade){
            this.upgradeDetails[upgradeName] = upgrade;
            promise.resolve(upgrade);
        }.bind(this)).except(function(err){
            this.errorMessage(err);
            promise.fail(err);
        }.bind(this));
    }

    return promise;
};

Session.prototype.refreshMissions = function(){
    this.client.getMissions().then(function(missions){
        this.missions = missions;
        signal(EVT_MISSIONS_UPDATED);

    }.bind(this));
};

Session.prototype.shipByName = function(shipName){
    for (var i = 0; i < this.ships.length; i++) {
        if(this.ships[i].name === shipName){
            return this.ships[i];
        }
    }
    return null;
};

Session.prototype.createCampaign = function(displayName){
    campaign = model.NewCampaign({
        displayName: displayName
    });
    this.client.createCampaign(campaign).then(function(){
        this.refreshCampaigns();
    }.bind(this)).except(function(err){
        this.errorMessage(err);
    }.bind(this));
};

Session.prototype.deleteCampaign = function(campaignid, version){
    this.client.deleteCampaign(campaignid, version).then(function(){
        this.refreshCampaigns();
    }.bind(this)).except(function(err){
        this.errorMessage(err);
    }.bind(this));
};

Session.prototype.createPilot = function(owner, callsign, shipName){
        var pilot = model.NewPilot({
            owner: owner,
            callsign: callsign,
            ship: shipName
        });
        this.client.createPilot(this.campaign._id, pilot).then(function(){
            this.refreshPilots();
        }.bind(this));
};

Session.prototype.deletePilot = function(pilotid, version){
    this.client.deletePilot(pilotid, version).then(function(){
        this.refreshPilots();
    }.bind(this)).except(function(err){
        this.errorMessage(err);
    }.bind(this));
};

Session.prototype.loadCampaign = function(campaignid){
    // TODO: properly unload() an existing campaign
    this.client.getCampaign(campaignid).then(function(campaign){
        this.campaign = campaign;
        signal(EVT_CAMPAIGN_UPDATED);
        this.refreshPilots();
    }.bind(this));
};

Session.prototype.loadPilot = function(pilotid){
    this.client.getPilot(pilotid).then(function(pilot){
        this.pilot = pilot;
        signal(EVT_PILOT_UPDATED);
    }.bind(this));
};

Session.prototype.loadMission = function(missionName){
    if(!this.missionDetails[missionName]){  // prevent duplicate requests
        this.client.getMission(missionName).then(function(mission){
            if(!this.missionDetails[mission.name]){  // prevent duplicate signal
                this.missionDetails[mission.name] = mission;
                signal(EVT_MISSION_DETAILS_UPDATED);
            }
        }.bind(this));
    }
};

Session.prototype.doAftermath = function(missionName, victory){
    var m = this.missionDetails[missionName];
    if(m){
        this.campaign.missionAftermath(m, victory);
        this.client.updateCampaign(this.campaign).then(function(){
            this.loadCampaign(this.campaign._id);
            this.refreshCampaigns();
        }.bind(this));
    }else{
        // load the mission details
        this.client.getMission(missionName).then(function(mission){
            if(!this.missionDetails[mission.name]){  // prevent duplicate signal
                this.missionDetails[mission.name] = mission;
                signal(EVT_MISSION_DETAILS_UPDATED);
            }

            this.campaign.missionAftermath(mission, victory);
            this.client.updateCampaign(this.campaign).then(function(){
                this.loadCampaign(this.campaign._id);
                this.refreshCampaigns();
            }.bind(this));
            // TODO rollback client state if server update failed ...
        }.bind(this));
    }
};

Session.prototype.doPilotAftermath = function(missionName, xp, kills){
    if(!this.pilot){
        this.errorMessage(errors.illegalState('Pilot not loaded'));
        return;
    }

    try{
        this.pilot.missionAftermath(missionName, xp, kills);
        this.client.updatePilot(this.pilot).then(function(){
            this.loadPilot(this.pilot._id);
            this.refreshPilots();
        }.bind(this)).except(function(err){
            this.errorMessage(err);
            //TODO set pilot back to previous state
        }.bind(this));
    }catch(err){
        this.errorMessage(err);
    }
};

Session.prototype.changeShip = function(shipName){
    if(!this.pilot){
        this.errorMessage(errors.illegalState('Pilot not loaded'));
        return;
    }else if(this.pilot.ship === shipName){
        this.errorMessage(errors.illegalState('Ship already selected'));
        return;
    }

    try{
        var ship = this.shipByName(shipName);  // throws
        this.pilot.changeShip(this.campaign.currentMission(), ship);  // throws
        this.client.updatePilot(this.pilot).then(function(){
            this.loadPilot(this.pilot._id);
            this.refreshPilots();
        }.bind(this)).except(function(err){
            this.errorMessage(err);
            //TODO set pilot back to previous state
        }.bind(this));
    }catch(err){
        this.errorMessage(err);
    }
};

Session.prototype.buyUpgrade = function(upgradename){
    this.client.getUpgrade(upgradename).then(function(upgrade){
        try{
            this.pilot.buyUpgrade(this.campaign.currentMission(), upgrade);
            this.client.updatePilot(this.pilot).then(function(){
                this.loadPilot(this.pilot._id);
            }.bind(this)).except(function(err){
                this.errorMessage(err);
            }.bind(this));
        }catch(err){
            this.errorMessage(err);
        }
    }.bind(this)).except(function(err){
        this.errorMessage(err);
    }.bind(this));
};


// Base View ------------------------------------------------------------------


_BaseView = function(name, session){
     this.name = name;
     this.selector = '#view-' + name;
     this.session = session;
     this._children = [];

     this.bindSignals();
};

_BaseView.prototype.bindSignals = function(){};

_BaseView.prototype._loadTemplate = function(){
    var promise = new prom.Promise();

    loadSnippet(this.name).then(function(template){
        promise.resolve(template);
    }.bind(this));

    return promise;
};

_BaseView.prototype.load = function(selector){
    this._loadTemplate().then(function(template){
        console.log('add ' + this.name + ' to ' + selector);
        $(selector).html(this._render(template));
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

_BaseView.prototype._render = function(template){
    return Mustache.render(template, this.getRenderContext());
};

_BaseView.prototype.refresh = function(){
    console.log('Refresh ' + this.name);
    this._loadTemplate().then(function(template){
        // unbind events?
        if($(this.selector).length === 0){
            console.log('view element ' + this.selector + ' not found');
        }
        $(this.selector).replaceWith(this._render(template));
        this.bindEvents();
    }.bind(this));
};


// Welcome View ---------------------------------------------------------------


WelcomeView = function(){
    _BaseView.call(this, 'welcome', null);
};

WelcomeView.prototype = new _BaseView();

WelcomeView.prototype.bindEvents = function(){
    $('#login').off('submit');
    $('#login').on('submit', function(evt){
        evt.preventDefault();
        var username = $('#login-username').val();
        var password = $('#login-password').val();
        new Session({username: username}).login(password);
    });
};


// Header View ----------------------------------------------------------------


HeaderView = function(session){
    _BaseView.call(this, 'header', session);
};

HeaderView.prototype = new _BaseView();

HeaderView.prototype.bindSignals = function(){
    onSignal(EVT_PILOTS_UPDATED, this.refresh.bind(this));
    onSignal(EVT_CAMPAIGN_UPDATED, this.refresh.bind(this));
};

HeaderView.prototype.bindEvents = function(){
    $('#header-home').off('click');
    $('#header-home').on('click', function(evt){
        evt.preventDefault();
        this.session.showHome();
    }.bind(this));

    $('#logout').off('click');
    $('#logout').on('click', function(evt){
        evt.preventDefault();
        this.session.logout();
    }.bind(this));

    $('#campaign-nav li a').each(function(index, a){
        $(a).off('click');
        $(a).on('click', function(evt){
            evt.preventDefault();
            var kind = $(evt.delegateTarget).data('kind');
            var id = $(evt.delegateTarget).data('id');
            if(kind === 'pilot'){
                this.session.showPilot(id);
            }else if(kind === 'campaign'){
                this.session.showCampaign(id);
            }
        }.bind(this));
    }.bind(this));
};

HeaderView.prototype.getRenderContext = function(){
    return {
        campaign: this.session.campaign,
        pilots: this.session.pilots
    };
};


// Messages View --------------------------------------------------------------


MessagesView = function(session){
    _BaseView.call(this, 'messages', session);
    this.showLog = false;
};

MessagesView.prototype = new _BaseView();

MessagesView.prototype.bindSignals = function(){
    onSignal(EVT_MESSAGE_UPDATED, this.refresh.bind(this));
};

MessagesView.prototype.bindEvents = function(){
    $('#message-dismiss').off('click');
    $('#message-dismiss').on('click', function(evt){
        evt.preventDefault();
        this.session.dismissMessage();
    }.bind(this));

    $('#message-log-toggle').off('click');
    $('#message-log-toggle').on('click', function(evt){
        evt.preventDefault();
        var content = $('#message-log');
        if(content.hasClass('hidden')){
            $('#message-log-toggle-icon').html(ARROW_DOWN);
            content.removeClass('hidden');
            this.showLog = true;
        }else{
            content.addClass('hidden');
            $('#message-log-toggle-icon').html(ARROW_RIGHT);
            this.showLog = false;
        }
    }.bind(this));
};

MessagesView.prototype.getRenderContext = function(){
    ctx = {};
    ctx.message = this.session.currentMessage;
    ctx.messages = this.session.messageLog;
    ctx.messagesCount = this.session.messageLog.length;
    ctx.logState = this.showLog ? 'show' : 'hidden';
    ctx.toggleIcon = this.showLog ? ARROW_DOWN : ARROW_RIGHT;
    return ctx;
};


// Home View ------------------------------------------------------------------


HomeView = function(session){
    _BaseView.call(this, 'home', session);
    this._children.push(new CampaignsView(session));
    this._children.push(new NewCampaignView(session));
};

HomeView.prototype = new _BaseView();


// Campaigns View -------------------------------------------------------------


CampaignsView = function(session){
    _BaseView.call(this, 'campaigns', session);
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
            var campaignid = $(evt.delegateTarget).data('id');
            this.session.showCampaign(campaignid);
        }.bind(this));
    }.bind(this));

    // delete buttons
    $(this.selector + ' li button').each(function(index, button){
        $(button).off('click');
        $(button).on('click', function(evt){
            var campaignid = $(evt.delegateTarget).data('id');
            var version = $(evt.delegateTarget).data('version');
            this.session.deleteCampaign(campaignid, version);
        }.bind(this));
    }.bind(this));
};

CampaignsView.prototype.getRenderContext = function(){
    return {
        campaigns: this.session.campaigns
    };
};


NewCampaignView = function(session){
    _BaseView.call(this, 'new-campaign', session);
};

NewCampaignView.prototype = new _BaseView();

NewCampaignView.prototype.bindEvents = function(){
    $('#campaign-start').off('submit');
    $('#campaign-start').on('submit', function(evt){
        evt.preventDefault();
        var displayName = $('#campaign-displayName').val();
        this.session.createCampaign(displayName);
        resetForm('#campaign-start');
    }.bind(this));
};


// Campaign View --------------------------------------------------------------


CampaignView = function(session){
    _BaseView.call(this, 'campaign', session);
    this._children.push(new PilotsView(session));
    this._children.push(new AddPilotView(session));
    this._children.push(new MissionsView(session));
    this._children.push(new MissionDeckView(session));
};

CampaignView.prototype = new _BaseView();


// Pilots View ----------------------------------------------------------------


PilotsView = function(session){
    _BaseView.call(this, 'pilots', session);
};

PilotsView.prototype = new _BaseView();

PilotsView.prototype.bindSignals = function(){
    onSignal(EVT_PILOTS_UPDATED, this.refresh.bind(this));
};

PilotsView.prototype.bindEvents = function(){
    // navigation links to show pilot details
    $(this.selector + ' li a').each(function(index, a){
        $(a).off('click');
        $(a).on('click', function(evt){
            evt.preventDefault();
            var pilotid = $(evt.delegateTarget).data('id');
            this.session.showPilot(pilotid);

        }.bind(this));
    }.bind(this));

    // delete buttons
    $(this.selector + ' li button').each(function(index, button){
        $(button).off('click');
        $(button).on('click', function(evt){
            var pilotid = $(evt.delegateTarget).data('id');
            var version = $(evt.delegateTarget).data('version');
            this.session.deletePilot(pilotid, version);
        }.bind(this));
    }.bind(this));
};

PilotsView.prototype.getRenderContext = function(){
    return {
        pilots: this.session.pilots
    };
};


// Add Pilot View -------------------------------------------------------------


AddPilotView = function(session){
    _BaseView.call(this, 'add-pilot', session);
};

AddPilotView.prototype = new _BaseView();

AddPilotView.prototype.bindSignals = function(){
    onSignal(EVT_USERS_UPDATED, this.refresh.bind(this));
    onSignal(EVT_SHIPS_UPDATED, this.refresh.bind(this));
};

AddPilotView.prototype.bindEvents = function(){
    $('#add-pilot').off('submit');
    $('#add-pilot').on('submit', function(evt){
        evt.preventDefault();
        var owner = $('#pilot-owner').val();
        var callsign = $('#pilot-callsign').val();
        var shipName = $('#pilot-ship').val();
        this.session.createPilot(owner, callsign, shipName);
        resetForm('#add-pilot');
    }.bind(this));
};

AddPilotView.prototype.getRenderContext = function(){
    var ships = [];
    for (var i = 0; i < this.session.ships.length; i++) {
        if(this.session.ships[i].startingShip){
            ships.push(this.session.ships[i]);
        }
    }
    return {
        users: this.session.users,
        ships: ships
    };
};


// Missions View --------------------------------------------------------------


MissionsView = function(session){
    _BaseView.call(this, 'missions', session);
};

MissionsView.prototype = new _BaseView();

MissionsView.prototype.bindSignals = function(){
    onSignal(EVT_CAMPAIGN_UPDATED, this.refresh.bind(this));
    onSignal(EVT_MISSION_DETAILS_UPDATED, this.refresh.bind(this));
};

MissionsView.prototype.bindEvents = function(){

};

MissionsView.prototype.getRenderContext = function(){
    var items = [];
    var totalRebelVP, totalImperialVP, victoryStatus;
    var campaign = this.session.campaign;
    if(campaign){
        items = campaign.playedMissions || [];
        totalRebelVP = campaign.totalRebelVP();
        totalImperialVP = campaign.totalImperialVP();
        victoryStatus = campaign.victoryStatus();
    }

    var playedMissions = [];
    for(var i = 0; i < items.length; i++) {

        var m = this.session.missionDetails[items[i].name];
        if(m){
            playedMissions.push({
                name: m.name,
                displayName: m.displayName,
                status: items[i].status,
                rebelVP: items[i].rebelVP,
                imperialVP: items[i].imperialVP
            });
        }else{
            this.session.loadMission(items[i].name);
        }
    }

    return {
        playedMissions: playedMissions,
        totalRebelVP: totalRebelVP,
        totalImperialVP: totalImperialVP,
        victoryStatus: victoryStatus
    };
};


// Mission Deck View ----------------------------------------------------------


MissionDeckView = function(session){
    _BaseView.call(this, 'mission-deck', session);
};

MissionDeckView.prototype = new _BaseView();

MissionDeckView.prototype.bindSignals = function(){
    onSignal(EVT_CAMPAIGN_UPDATED, this.refresh.bind(this));
    onSignal(EVT_MISSION_DETAILS_UPDATED, this.refresh.bind(this));
};

MissionDeckView.prototype.bindEvents = function(){
    $(this.selector + ' button').off('click');
    $(this.selector + ' button').on('click', function(evt){
        var missionName = $(evt.delegateTarget).data('id');
        var status = $(evt.delegateTarget).data('status');
        var victory = status === 'victory';
        this.session.doAftermath(missionName, victory);
    }.bind(this));
};

MissionDeckView.prototype.getRenderContext = function(){
    var names = [];
    if(this.session.campaign){
        names = this.session.campaign.missionDeck || [];
    }

    var missions = [];
    for(var i = 0; i < names.length; i++) {
        var m = this.session.missionDetails[names[i]];
        if(m){
            missions.push(m);
        }else{
            this.session.loadMission(names[i]);
        }
    }

    return {
        missions: missions
    };
};


// Pilot View -----------------------------------------------------------------


PilotView = function(session){
    _BaseView.call(this, 'pilot', session);
    this._children.push(new PilotDetailsView(session));
    this._children.push(new PilotMissionsView(session));
    this._children.push(new PilotKillsView(session));
    this._children.push(new PilotUpgradesView(session));
    this._children.push(new PilotAftermathView(session));
    this._children.push(new PilotShipView(session));
    this._children.push(new StoreView(session));
};

PilotView.prototype = new _BaseView();


// Pilot Details View ---------------------------------------------------------


PilotDetailsView = function(session){
    _BaseView.call(this, 'pilot-details', session);
};

PilotDetailsView.prototype = new _BaseView();

PilotDetailsView.prototype.bindSignals = function(){
    onSignal(EVT_PILOT_UPDATED, this.refresh.bind(this));
};

PilotDetailsView.prototype.getRenderContext = function(){
    var pilot = this.session.pilot;
    var ctx = {
        pilot: pilot,
        currentXP: '-',
        pilotSkill: '-',
        ship: null
    };
    if(pilot){
        ctx.currentXP = pilot.currentXP();
        ctx.pilotSkill = pilot.skill();
        ctx.ship = this.session.shipByName(pilot.ship);
    }
    return ctx;
};


// Pilot Missions View --------------------------------------------------------


PilotMissionsView = function(session){
    _BaseView.call(this, 'pilot-missions', session);
};

PilotMissionsView.prototype = new _BaseView();

PilotMissionsView.prototype.bindSignals = function(){
    onSignal(EVT_PILOT_UPDATED, this.refresh.bind(this));
        onSignal(EVT_MISSION_DETAILS_UPDATED, this.refresh.bind(this));
};

PilotMissionsView.prototype.getRenderContext = function(){
    var pilot = this.session.pilot;
    var campaign = this.session.campaign;
    var ctx = {
        playedMissions: [],
        totalEarnedXP: '-'
    };

    if(pilot){
        ctx.totalEarnedXP = pilot.totalEarnedXP();
    }

    if(campaign){
        var playedMissions = campaign.playedMissions;
        for (var i = 0; i < playedMissions.length; i++) {
            var name = playedMissions[i].name;
            var m = this.session.missionDetails[name];
            if(m){
                ctx.playedMissions.push(m);
                if(pilot){
                    // played mission for the pilot
                    m._xp = pilot.totalEarnedXP(m.name);
                }
            }
        }
    }

    return ctx;
};


// Pilot Kills View -----------------------------------------------------------


PilotKillsView = function(session){
    _BaseView.call(this, 'pilot-kills', session);
};

PilotKillsView.prototype = new _BaseView();


// Pilot Upgrades View --------------------------------------------------------


PilotUpgradesView = function(session){
    _BaseView.call(this, 'pilot-upgrades', session);
};

PilotUpgradesView.prototype = new _BaseView();


// Pilot Aftermath View -------------------------------------------------------


PilotAftermathView = function(session){
    _BaseView.call(this, 'pilot-aftermath', session);
};

PilotAftermathView.prototype = new _BaseView();

PilotAftermathView.prototype.bindSignals = function(){
    onSignal(EVT_CAMPAIGN_UPDATED, this.refresh.bind(this));
    onSignal(EVT_MISSION_DETAILS_UPDATED, this.refresh.bind(this));
};

PilotAftermathView.prototype.bindEvents = function(){
    $('#pilot-aftermath').off('submit');
    $('#pilot-aftermath').on('submit', function(evt){
        evt.preventDefault();
        var missionName = $('#pilot-aftermath-mission').val();
        var xp = parseInt($('#pilot-aftermath-xp').val() || 0, 10);
        var kills = {};
        $('#pilot-aftermath input').each(function(input){
            var kind = $(input).data('kind');
            if(kind){
                kills[kind] = parseInt($(input).val() || 0, 10);
            }
        }.bind(this));
        this.session.doPilotAftermath(missionName, xp, kills);
        resetForm('#pilot-aftermath');
    }.bind(this));
};

PilotAftermathView.prototype.getRenderContext = function(){
    var ctx = {
        playedMissions: [],
        enemyShips: model.enemyShips
    };

    var campaign = this.session.campaign;

    if(campaign){
        var playedMissions = campaign.playedMissions;
        for (var i = 0; i < playedMissions.length; i++) {
            var name = playedMissions[i].name;
            var m = this.session.missionDetails[name];
            if(m){
                // select control for aftermath form
                m._ui_selected = i === (playedMissions.length -1) ? 'selected' : '';
                ctx.playedMissions.push(m);
            }
        }
    }

    return ctx;
};


// Pilot Ship View ------------------------------------------------------------


PilotShipView = function(session){
    _BaseView.call(this, 'pilot-ship', session);
};

PilotShipView.prototype = new _BaseView();

PilotShipView.prototype.bindSignals = function(){
    onSignal(EVT_PILOT_UPDATED, this.refresh.bind(this));
    onSignal(EVT_SHIPS_UPDATED, this.refresh.bind(this));
};

PilotShipView.prototype.bindEvents = function(){
    $('#pilot-change-ship').off('submit');
    $('#pilot-change-ship').on('submit', function(evt){
        evt.preventDefault();
        var shipName = $('#pilot-change-ship-name').val();
        this.session.changeShip(shipName);
    }.bind(this));
};

PilotShipView.prototype.getRenderContext = function(){
    var ctx = {
        ship: null,
        ships: this.session.ships,
    };

    var pilot = this.session.pilot;

    if(pilot){
        ctx.ship = this.session.shipByName(pilot.ship);
    }
    return ctx;
};


// Store View -----------------------------------------------------------------


StoreView = function(session){
    _BaseView.call(this, 'store', session);
    this.selectedSlot = model.SLOTS[0];
};

StoreView.prototype = new _BaseView();

StoreView.prototype.bindSignals = function(){
    onSignal(EVT_PILOT_UPDATED, this.refresh.bind(this));
    onSignal(EVT_UPGRADES_UPDATED, this.refresh.bind(this));
};

StoreView.prototype.bindEvents = function(){
    // init show/hide details
    $('#pilot-upgrades [data-toggle="trigger"]').on('click', function(evt){
        var upgradeName = $(evt.delegateTarget).data('id');
        this.session.getUpgrade(upgradeName).then(function(upgrade){
            var root = $('#pilot-upgrades [data-id="' + upgradeName + '"]');
            if(root){
                var content = root.find('[data-toggle="content"]');
                var show = root.find('[data-toggle="show"]');
                if(content){
                    content.text(upgrade.description);
                }

                if(show){
                    if(show.hasClass('hidden')){
                        show.removeClass('hidden');
                    }else{
                        show.addClass('hidden');
                    }
                }
            }
        });
    }.bind(this));

    // nav buttons
    $(this.selector + ' ul.nav li a').off('click');
    $(this.selector + ' ul.nav li a').on('click', function(evt){
        evt.preventDefault();
        var slot = $(evt.delegateTarget).data('id');
        this.selectedSlot = slot;
        this.refresh();
    }.bind(this));

    // buy items
    $('#pilot-upgrades button').each(function(index, button){
        $(button).off('click');
        $(button).on('click', function(evt){
            evt.preventDefault();
            var upgradename = $(evt.delegateTarget).data('id');
            this.session.buyUpgrade(upgradename);
        }.bind(this));
    }.bind(this));
};

StoreView.prototype.getRenderContext = function(){

    var decanonicalize = function(s){
        return s.split('-').map(function(word){
            return word.substring(0, 1).toUpperCase() + word.substring(1);
        }).join(' ');
    };

    var pilot = this.session.pilot;
    var ctx = {
        decanonicalize: function(){
            return function(text, render){
                return decanonicalize(render(text));
            };
        },
        upgrades: [],
        slots: []
    };

    ctx.slots= model.SLOTS.map(function(slot){
        return {
            name: slot,
            active: slot === this.selectedSlot ? 'active' : '',
            displayName: decanonicalize(slot)
        };
    }.bind(this));

    if(this.session.upgrades){
        ctx.upgrades = this.session.upgrades.filter(function(item){
            return item.slot === this.selectedSlot;
        }.bind(this)).map(function(item){
            item.owned = 0;
            if(pilot){
                item.owned = pilot.upgrades.filter(function(name){
                    return name === item.name;
                }).length;
            }
            return item;
        }.bind(this));
    }
    return ctx;
};


// ----------------------------------------------------------------------------


var show = function(where, view){
    //TODO: determine if the requested view is already showing.
    // do not load it then
    view.load(where);
};


var resetForm = function(formSelector){
    $(formSelector + ' input').each(function(index, input){
        $(input).val('');
    });
    $(formSelector + ' select').each(function(index, select){
        $(select).val('');
    });
};


var snippets = {};

var loadSnippet = function(name){
    var promise = new prom.Promise();

    if(snippets[name]){
        promise.resolve(snippets[name]);
    }else{
        $.ajax({
            url: 'snippets/' + name + '.html'
        }).done(function(content){
            snippets[name] = content;
            promise.resolve(content);
        });
    }

    return promise;
};


$(function(){
    show('#main', new WelcomeView());
});
