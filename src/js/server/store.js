var mongodb = require('mongodb'),
    prom = require('../common/promise');

var client = mongodb.MongoClient;
var ObjectID = mongodb.ObjectID;
var _dbURL;
var _conn;


var setup = function(dbURL, callback){
    console.log('Setup database');
    _dbURL = dbURL;

    _db(function(err, db){
        if(!err){
            console.log('create collections');
            db.createCollection('users', function(err, collection){});
            db.createCollection('campaigns', function(err, collection){});
            db.createCollection('pilots', function(err, collection){});
            db.createCollection('shiptypes', function(err, collection){});
        }
        callback(err);
    });
};


var _db = function(callback){
    if(_conn){
        callback(null, _conn);
    }else{
        if(!_dbURL){
            callback("DatabaseNotInitialized", null);
        }else{
            client.connect(_dbURL, function(err, db){
                console.log('connect to database');
                if(!err){
                    _conn = db;
                }else{
                    console.log(err);
                }
                callback(err, _conn);
            });
        }
    }
};


var identity = function(doc){
    return doc;
};


Collection = function(name, wrapper, unwrapper){
    this.name = name;
    this._wrap = wrapper || identity;
    this._unwrap = unwrapper || identity;
};

Collection.prototype.get = function(docid){
    var promise = new prom.Promise();

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            db.collection(this.name).findOne(
                {_id: new ObjectID(docid)},
                function(lookupErr, doc){
                    if(lookupErr){
                        promise.fail(lookupErr);
                    }else{
                        promise.resolve(this._wrap(doc));
                    }
                }.bind(this)
            );
        }
    }.bind(this));

    return promise;
};


Collection.prototype.put = function(doc){
    var promise = new prom.Promise();

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            var docToStore = this._unwrap(doc);
            if(docToStore._id){
                db.collection(this.name).update(docToStore, function(err, status){
                    if(err){
                        promise.fail(err);
                    }else{
                        promise.resolve(status.insertedIds);
                    }
                });
            }else{
                db.collection(this.name).insert(docToStore, function(err, status){
                    if(err){
                        promise.fail(err);
                    }else{
                        promise.resolve(status.insertedIds);
                    }
                });
            }
        }
    }.bind(this));

    return promise;
};


Collections.prototype.iter = function(predicate){
    var promise = new prom.Promise();

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            var stream = db.collection(this.name).find(predicate).stream();
            stream.on('data', function(doc){
                promise.push(doc);
            });
            stream.on('end', function(){
                promise.complete();
            });
        }
    }.bind(this));

    return promise;
};


module.exports.users = new Collection('users');

module.exports.setup = setup;
