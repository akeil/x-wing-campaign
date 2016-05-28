var apiclient = require('./apiclient'),
    model = require('../common/model'),
    prom = require('../common/promise');

var $ = require('jquery');
window.jQuery = $;  // jQueryUI expects this to be set
var jqueryui = require('jqueryui');
var Mustache = require('mustache');


// ----------------------------------------------------------------------------

var EVT_USER_UPDATED = 'xwing:user-updated';
var EVT_CAMPAIGNS_UPDATED = 'xwing:campaigns-updated';

var signal = function(eventName){
    console.log('Signal ' + eventName);
    $(document).trigger(eventName);
};

var onSignal = function(eventName, callback){
    $(document).on(eventName, callback);
};




Session = function(props){
    this.username = props.username;
    this.client = new apiclient.Client();
    this.user = null;

    this.campaigns = null;
};

Session.prototype.setup = function(){
    this.client.getUser(this.username).then(function(user){
        this.user = user;
        signal(EVT_USER_UPDATED);
        this.refreshCampaigns();
    }.bind(this));
};

Session.prototype.refreshCampaigns = function(){
    this.client.getCampaigns(this.user.name).then(function(campaigns){
        this.campaigns = campaigns;
        signal(EVT_CAMPAIGNS_UPDATED);
    }.bind(this));
};

Session.prototype.createCampaign = function(displayName){
    campaign = new model.Campaign({
        displayName: displayName
    });
    this.client.createCampaign(campaign, this.user.name).then(function(){
        this.refreshCampaigns();
    }.bind(this));
};


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



StartView = function(session){
    _BaseView.call(this, 'start', '#view-start', session);
    this._children.push(new CampaignsView(session));
    this._children.push(new NewCampaignView(session));
};

StartView.prototype = new _BaseView();



CampaignsView = function(session){
    _BaseView.call(this, 'campaigns', '#view-campaigns', session);
};

CampaignsView.prototype = new _BaseView();

CampaignsView.prototype.bindSignals = function(){
    onSignal(EVT_CAMPAIGNS_UPDATED, this.refresh.bind(this));
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


var setMainView = function(viewName, session){
    var view = new StartView(session);
    view.load('#view-main');
};


var showCampaign = function(campaignid, session){

};

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
    setMainView('start', session);
    session.setup();
};

$(main);
