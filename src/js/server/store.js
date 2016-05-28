var mongodb = require('mongodb'),
    prom = require('../common/promise');

var client = mongodb.MongoClient;
var ObjectID = mongodb.ObjectID;
var _dbURL;
var _conn;

var INDEX_TYPE_ASC = 1;

var setup = function(dbURL, callback){
    console.log('Setup database');
    _dbURL = dbURL;

    _db(function(err, db){
        if(!err){
            console.log('create collections');
            db.createCollection('users', function(err, collection){
                if(!err){
                    console.log('create index for user.name');
                    collection.createIndex(
                        {'name': INDEX_TYPE_ASC},
                        {unique: true, name: 'users_name_unique'}
                    );
                }else{
                    console.log(err);
                }
            });

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

/*
 * Get a single document by ID
 */
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


/*
 * Delete a single document by id.
 */
Collection.prototype.delete = function(docid){
    var promise = new prom.Promise();

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            db.collection(this.name).remove(
                {_id: new ObjectID(docid)},
                {},  // no options
                function(opErr, docsRemoved){
                    if(opErr){
                        promise.fail(opErr);
                    }else{
                        promise.resolve(null);
                    }
                }
            );
        }
    }.bind(this));

    return promise;
};



Collection.prototype.findOne = function(predicate){
    var promise = new prom.Promise();

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            db.collection(this.name).findOne(
                predicate,
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
                        if(err.code === 11000){
                            // TODO: duplicate key error
                        }
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


/*
 * Find multiple documents that match the given predicate
 */
//TODO limit + offset
Collection.prototype.select = function(predicate, fields){
    var promise = new prom.Promise();

    optFields = {};
    for(var i=0; i < fields.length; i++){
        optFields[fields[i]] = true;
    }

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            var cursor = db.collection(this.name).find(predicate, optFields);
            cursor.toArray(
                function(lookupErr, results){
                    if(lookupErr){
                        promise.fail(lookupErr);
                    }else{
                        promise.resolve(results);
                    }
                }
            );
        }
    }.bind(this));

    return promise;
};


module.exports.users = new Collection('users');
module.exports.campaigns = new Collection('campaigns');

module.exports.setup = setup;
