/*
 * Interaction with the MongDB.
 *
 * This module establishes and holds the DB connection.
 *
 * The store must be initialized by calling `store.setup()`.
 *
 * After that, collections can be accessed through `Collection`
 * objects which are set up per collection, i.e.:
 * ```
 * store.campaigns.get(id);
 *```
 */
var mongodb = require('mongodb'),
    model = require('../common/model'),
    prom = require('../common/promise'),
    errors = require('../common/errors');


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

            db.createCollection('sessions', function(err, collection){
                if(!err){
                    console.log('create index for session.token');
                    collection.createIndex(
                        {'token': INDEX_TYPE_ASC},
                        {unique: true, name: 'sessions_token_unique'}
                    );
                    console.log('create index for session.csrfToken');
                    collection.createIndex(
                        {'csrfToken': INDEX_TYPE_ASC},
                        {unique: true, name: 'sessions_csrfToken_unique'}
                    );
                }else{
                    console.log(err);
                }
            });

            db.createCollection('campaigns', function(err, collection){});
            db.createCollection('pilots', function(err, collection){});
            db.createCollection('ships', function(err, collection){
                if(!err){
                    console.log('create index for ship.name');
                    collection.createIndex(
                        {'name': INDEX_TYPE_ASC},
                        {unique: true, name: 'ships_name_unique'},
                        function(err){
                            console.log(err);
                        }
                    );
                }else{
                    console.log(err);
                }
            });

            db.createCollection('upgrades', function(err, collection){
                if(!err){
                    console.log('create index for upgrade.name');
                    collection.createIndex(
                        {'name': INDEX_TYPE_ASC},
                        {unique: true, name: 'upgrades_name_unique'},
                        function(err){
                            console.log(err);
                        }
                    );
                    collection.createIndex(
                        {'slot': INDEX_TYPE_ASC},
                        {unique: false, name: 'upgrades_slot'},
                        function(err){
                            console.log(err);
                        }
                    );

                }else{
                    console.log(err);
                }
            });

            db.createCollection('missions', function(err, collection){
                if(!err){
                    console.log('create index for mission.name');
                    collection.createIndex(
                        {'name': INDEX_TYPE_ASC},
                        {unique: true, name: 'missions_name_unique'},
                        function(err){
                            console.log(err);
                        }
                    );
                }else{
                    console.log(err);
                }
            });

            console.log(err);
        }
        callback(err);
    });
};


var _db = function(callback){
    if(_conn){
        callback(null, _conn);
    }else{
        if(!_dbURL){
            callback(errors.illegalState('Database not initialized'), null);
        }else{
            client.connect(_dbURL, function(err, db){
                console.log('Connect to database');
                if(!err){
                    _conn = db;
                    callback(null, _conn);
                }else{
                    console.log(err);
                    var msg = 'Could not connect to database';
                    callback(errors.databaseError(msg), _conn);
                }
            });
        }
    }
};


var identity = function(doc){
    return doc;
};


/*
 * Access a MongoDB collection.
 */
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
                        promise.fail(errors.databaseError('Lookup error'));
                    }else if(doc === null){
                        var msg = 'No document with id ' + docid;
                        promise.fail(errors.notFound(msg));
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
                        console.log(opErr);
                        promise.fail(errors.databaseError('Delete error'));
                    }else{
                        promise.resolve();
                    }
                }
            );
        }
    }.bind(this));

    return promise;
};

/*
 * Find a single document by the given predicats.
 * It is an error if multiple documents are found.
 */
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
                        promise.fail(errors.databaseError('Lookup error'));
                    }else if(doc === null){
                        var msg = 'No matching document found';
                        promise.fail(errors.notFound(msg));
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
 * Save a single document.
 * If the document has its `_id` field set,
 * an update operation is attempted, otherwise an `insert`.
 */
Collection.prototype.put = function(doc){

    // TODO: assert that this is actually a single doc

    var promise = new prom.Promise();

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            var docToStore = this._unwrap(doc);
            var docid = docToStore._id;
            if(docid){
                console.log('Update ' + this.name + '/' + docid);
                delete docToStore._id;  // MongoDB will attempt to update if present
                predicate = {_id: new ObjectID(docid)};
                db.collection(this.name).replaceOne(predicate, docToStore, function(err, status){
                    if(err){
                        console.log(err);
                        // TODO:
                        // notFound
                        // invalid
                        // conflict
                        promise.fail(errors.databaseError('Update error'));
                    }else{
                        // TODO check status.matchedCount === 1 ?
                        promise.resolve();
                    }
                });
            }else{
                db.collection(this.name).insert(docToStore, function(err, status){
                    if(err){
                        if(err.code === 11000){
                            // TODO: duplicate key error
                            promise.fail(errors.conflict('Duplicate key'));
                        }else{
                            promise.fail(errors.databaseError('Insert error'));
                        }
                    }else{
                        promise.resolve(status.insertedIds[0]);
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
                        promise.fail(errors.databaseError('Lookup error'));
                    }else{
                        promise.resolve(results);
                    }
                }
            );
        }
    }.bind(this));

    return promise;
};


// Exports --------------------------------------------------------------------


module.exports.users = new Collection('users', model.NewUser);
module.exports.sessions = new Collection('sessions');
module.exports.campaigns = new Collection('campaigns', model.NewCampaign);
module.exports.pilots = new Collection('pilots', model.NewPilot);
module.exports.ships = new Collection('ships', model.NewShip);
module.exports.upgrades = new Collection('upgrades', model.NewUpgrade);
module.exports.missions = new Collection('missions', model.NewMission);

module.exports.setup = setup;
