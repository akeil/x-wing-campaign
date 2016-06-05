/*
 * Start script for the application.
 * - Reads configurration
 * - Initializes the database and API,
 * - Starts listening for requests
 */
var express = require('express'),
    cookieParser = require('cookie-parser'),
    serveStatic = require('serve-static'),
    api = require('./api'),
    auth = require('./auth'),
    store = require('./store');


// for openshift or local installation
var host, port, dbName, dburl;
host = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

var dbHost, dbPort, dbUser, dbPass, dbName;
if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
    dbHost = process.env.OPENSHIFT_MONGODB_DB_HOST;
    dbPort = process.env.OPENSHIFT_MONGODB_DB_PORT;
    dbUser = process.env.OPENSHIFT_MONGODB_DB_USERNAME;
    dbPass = process.env.OPENSHIFT_MONGODB_DB_PASSWORD;
}else{
    dbHost = 'localhost';
    dbPort = '27017';
    dbUser = '';
    dbPass = '';
}
dbName = 'xwing';

dburl = 'mongodb://';
if(dbPass){
    dburl += dbUser + ':' + dbPass + '@';
}
dburl += dbHost + ':' + dbPort;
dburl += '/' + dbName;

console.log('Listen on ' + host + ':' + port);
console.log('Database at ' + dbHost + ':' + dbPort + '/' + dbName);

var app = express();

app.locals.title = 'X-Wing Campaign';
app.locals.email = 'alex@akeil.net';


// log every request
app.use('/', function(req, res, next){
    console.log(req.method + ' ' + req.originalUrl);
    next();
});

// serve static content on '/' from 'www/*'
console.log('Static dir is ' + __dirname + '/../www');
app.use(serveStatic(__dirname + '/../www', {
    index: ['index.htm', 'index.html'],
    extensions: ['htm', 'html']
}));
app.use('/js', serveStatic(__dirname + '/../www/js'));
app.use('/css', serveStatic(__dirname + '/../www/css'));
app.use('/img', serveStatic(__dirname + '/../www/img'));

app.use(cookieParser());

// mount sub-apps
app.use('/auth', auth.app);
app.use('/api', api());


// insert some constant data into the db
// TODO does not belong here ...
var _initShips = function(){
    var fs = require('fs'),
        model = require('../common/model');
    var path = './data/ships.json';
    fs.readFile(path, function(err, contents){
        if(!err){
            var items = JSON.parse(contents);
            for(var i=0; i < items.length; i++){
                console.log('insert ship ' + items[i].name);
                store.ships.put(model.NewShip(items[i]));
            }
        }
    });
};


var _initUpgrades = function(){
    var fs = require('fs'),
        model = require('../common/model');
    var path = './data/upgrades';

    var oneFile = function(err, contents){
        if(!err){
            var items = JSON.parse(contents);
            for(var i=0; i < items.length; i++){
                console.log('insert upgrade ' + items[i].name);
                store.upgrades.put(model.NewUpgrade(items[i]));
            }
        }
    };

    fs.readdir(path, function(err, files){
        for(var i = 0; i < files.length; i++) {
            if(!err){
                console.log('Read ' + files[i]);
                fs.readFile(path + '/' + files[i], oneFile);
            }
        }
    });
};

var _initMissions = function(){
    var fs = require('fs'),
        model = require('../common/model');
    var path = './data/missions.json';
    fs.readFile(path, function(err, contents){
        if(!err){
            var items = JSON.parse(contents);
            for(var i=0; i < items.length; i++){
                console.log('insert mission ' + items[i].name);
                store.missions.put(model.NewMission(items[i]));
            }
        }
    });
};


store.setup(dburl, function(err){
    if(err){
        console.log(err);
    }else{
        _initShips();
        _initUpgrades();
        _initMissions();
        app.listen(port, host);
    }
});

console.log('Webserver started on port ' + port);
