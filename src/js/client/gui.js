var apiclient = require('./apiclient'),
    model = require('../common/model'),
    prom = require('../common/promise');

var $ = require('jquery');
window.jQuery = $;  // jQueryUI expects this to be set
var jqueryui = require('jqueryui');
var Mustache = require('mustache');


// ----------------------------------------------------------------------------

Session = function(props){
    this.username = props.username;
    this.setup();
};

Session.prototype.setup = function(){
    this.user = new model.User({name: this.username, displayName: "Foo User"});
};


var setMainView = function(viewName, session){
    var view = new StartView(session);
    view.load().then(function(){
        $('#mainView').html(view.render());
        view.setup();
    });
};


StartView = function(session){
    this.name = 'start';
    this.selector = '#view-start';
    this.template = '';
    this.session = session;
};

StartView.prototype.setup = function(){
    console.log('setup view');
    console.log($('#campaign-start'));
    $('#campaign-start').submit(function(evt){
        evt.preventDefault();
        var displayName = $('#campaign-displayName').val();
        console.log('name: ' + displayName);
        campaign = new model.Campaign({
            displayName: displayName
        });
    });
};

StartView.prototype.load = function(){
    var promise = new prom.Promise();
    // TODO cache snippets
    fetchView(this.name).then(function(template){
        this.template = template;
        promise.resolve();
    }.bind(this));

    return promise;
};

StartView.prototype.render = function(){
    var ctx = {
        user: this.session.user,
        campaigns: [{displayName: 'Foo'}, {displayName: 'Bar'}]
    };
    return Mustache.render(this.template, ctx);
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
};

$(main);
