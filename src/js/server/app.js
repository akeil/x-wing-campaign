/*
 * Start script for the application.
 * - Reads configurration
 * - Initializes the database and API,
 * - Starts listening for requests
 */
var express = require('express'),
    cookieParser = require('cookie-parser'),
    serveStatic = require('serve-static'),
    url = require('url'),
    api = require('./api'),
    auth = require('./auth'),
    store = require('./store'),
    fixtures = require('./fixtures');


// for openshift or local installation
var host, port, dburl;
host = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080;

// DB connection details from URL or indivudual settings
// see https://developers.openshift.com/managing-your-applications/environment-variables.html#database-variables
// for OpenShift environment variables.
dburl = 'mongodb://localhost:27017/xwing';
dburl = process.env.DB_URL || process.env.OPENSHIFT_MONGODB_DB_URL || dburl;


if(!dburl){
    var openshiftService = process.env.DATABASE_SERVICE_NAME.toUpperCase();
    var openshiftDB = process.env[openshiftService + '_DATABASE'];
    var dbHost, dbPort, dbUser, dbPass, dbName;
    dbHost = process.env.DB_HOST || process.env.OPENSHIFT_MONGODB_DB_HOST || 'localhost';
    dbPort = process.env.DB_PORT || process.env.OPENSHIFT_MONGODB_DB_PORT || 27017;
    dbUser = process.env.DB_USER || process.env.OPENSHIFT_MONGODB_DB_USERNAME || '';
    dbPass = process.env.DB_PASS || process.env.OPENSHIFT_MONGODB_DB_PASSWORD || '';
    dbName = process.env.DB_NAME || openshiftDB || 'xwing';

    dburl = 'mongodb://';
    if(dbPass){
        dburl += dbUser + ':' + dbPass + '@';
    }
    dburl += dbHost + ':' + dbPort;
    dburl += '/' + dbName;
}

console.log('Listen on ' + host + ':' + port);
parsed = url.parse(dburl);  // do not write user:pass to log
console.log('Database at ' + parsed.hostname + ':' + parsed.port + parsed.pathname);


var app = express();

app.locals.title = 'X-Wing Campaign';
app.locals.email = 'alex@akeil.net';

var staticdir = __dirname + '/../www';
var datadir = __dirname + '/../data';
console.log('Static dir is ' + staticdir);
console.log('Data dir is ' + datadir);


// log every request
app.use('/', function(req, res, next){
    console.log(req.method + ' ' + req.originalUrl);
    next();
});

app.use(serveStatic(staticdir, {
    index: ['index.htm', 'index.html'],
    extensions: ['htm', 'html']
}));
app.use('/js', serveStatic(staticdir + '/js'));
app.use('/css', serveStatic(staticdir + '/css'));
app.use('/img', serveStatic(staticdir + '/img'));
app.use('/fonts', serveStatic(staticdir + '/fonts'));

app.use(cookieParser());  // for auth

// mount sub-apps
app.use('/auth', auth.app);
app.use('/api', api());


store.setup(dburl, function(err){
    if(err){
        console.error(err);
        process.exit(1);
    }else{
        fixtures.initAll(datadir, function(err){
            if(err){
                console.error(err);
                console.log('failed to initialize fixtures');
                process.exit(1);
            }else{
                app.listen(port, host);
                console.log('webserver started on port ' + port);
            }
        });
    }
});
