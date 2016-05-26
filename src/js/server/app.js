var express = require('express'),
    serveStatic = require('serve-static'),
    api = require('./api'),
    store = require('./store');

// for openshift
var port, host, dbname, dburl;
port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
host = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

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
dbName = 'x-wing-campaign';

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

// serve static content from '/' (webroot)
console.log('Static dir is ' + __dirname + '/../www');
app.use(serveStatic(__dirname + '/../www', {
    index: ['index.htm', 'index.html'],
    extensions: ['htm', 'html']
}));
app.use('/js', serveStatic(__dirname + '/../www/js'));
app.use('/css', serveStatic(__dirname + '/../www/css'));
app.use('/img', serveStatic(__dirname + '/../www/img'));

// mount sub-apps
// remove if you do not use api.js
app.use('/api', api());

store.setup(dburl, function(err){
    if(err){
        console.log(err);
    }else{
        app.listen(port);
    }
});

console.log('Webserver listening on port ' + port);
