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

var COLLECTIONS = [
    'users',
    'sessions',
    'campaigns',
    'pilots',
    'ships',
    'upgrades',
    'missions'
];

var INDICES = {
    users: [
        {
            spec: {'name': INDEX_TYPE_ASC},
            opts: {unique: true, name: 'users_name_unique'}
        }
    ],
    sessions: [
        {
            spec: {'token': INDEX_TYPE_ASC},
            opts: {unique: true, name: 'sessions_token_unique'}
        },
        {
            spec: {'csrfToken': INDEX_TYPE_ASC},
            opts: {unique: true, name: 'sessions_csrfToken_unique'}
        }
    ],
    ships: [
        {
            spec: {'name': INDEX_TYPE_ASC},
            opts: {unique: true, name: 'ships_name_unique'}
        }
    ],
    upgrades: [
        {
            spec: {'name': INDEX_TYPE_ASC},
            opts: {unique: true, name: 'upgrades_name_unique'}
        },
        {
            spec: {'slot': INDEX_TYPE_ASC},
            opts: {unique: false, name: 'upgrades_slot'},
        }
    ],
    missions: [
        {
            spec: {'name': INDEX_TYPE_ASC},
            opts: {unique: true, name: 'missions_name_unique'}
        }
    ]
};


// create configured indices recursively
var makeIndex = function(collection, i, finalCallback){
    specs = INDICES[collection.collectionName] || [];
    if(i < specs.length){
        var spec = specs[i].spec;
        var opts = specs[i].opts;
        console.log('create index ' + opts.name);
        collection.ensureIndex(spec, opts, function(err){
            if(!err){
                makeIndex(collection, i + 1, finalCallback);
            }else{
                console.log('failed to create index ' + opts.name);
                finalCallback(err);
            }
        });
    }else{
        finalCallback();  // all indices created
    }

};

// create configured collections recursively
// callback is invoked after all collections + indieces are created
var makeColl = function(db, i, finalCallback){
    if(i < COLLECTIONS.length){
        var name = COLLECTIONS[i];
        console.log('create collection ' + name);
        db.createCollection(name, function(err, collection){
            if(!err){
                // indices for this collection
                makeIndex(collection, 0, function(err){
                    if(!err){
                        // next collection
                        makeColl(db, i + 1, finalCallback);
                    }else{
                        finalCallback(err);
                    }
                });

            }else{
                console.log('failed to create collection ' + name);
                finalCallback(err);  // failed
            }
        });
    }else{
        finalCallback();  // all collections created
    }
};


var setup = function(dbURL, callback){
    console.log('setup database');
    _dbURL = dbURL;  //  global variable
    _db(function(err, db){
        if(!err){
            makeColl(db, 0, callback);
        }else{
            callback(err);
        }
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
                console.log('connect to database');
                if(!err){
                    _conn = db;
                    callback(null, _conn);
                }else{
                    console.error(err);
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
 * Delete a single document by id and version.
 */
Collection.prototype.delete = function(docid, version){
    var promise = new prom.Promise();

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            var predicate = {
                _id: new ObjectID(docid),
                version: parseInt(version)
            };
            var opts = {w: 1};  // write concern, acknowledge write
            db.collection(this.name).remove(predicate, opts, function(opErr, result){
                if(opErr){
                    console.error(opErr);
                    promise.fail(errors.databaseError('Delete error'));
                }else{
                    var numberOfDocsRemoved = result.result.n;
                    if(numberOfDocsRemoved === 1){
                        promise.resolve();
                    }else if(numberOfDocsRemoved === 0) {
                        this.get(docid).then(function(){
                            // found by ID, but not by ID + version
                            promise.fail(errors.lockingError());
                        }).except(promise.fail);
                    }else{
                        // deleted more than one document
                        // this REALLY should not happen
                        promise.fail(errors.illegalState('More than one document deleted'));
                    }
                }
            }.bind(this));
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
            docToStore.lastModified = new Date().getTime();  // now, UTC
            var docid = docToStore._id;
            if(docid){
                console.log('Update ' + this.name + '/' + docid);
                delete docToStore._id;  // MongoDB will attempt to update if present
                var version = parseInt(docToStore.version);
                var predicate = {
                    _id: new ObjectID(docid),
                    version: version
                };
                docToStore.version = version + 1;
                var opts = {w: 1};
                db.collection(this.name).replaceOne(predicate, docToStore, opts, function(err, result){
                    if(err){
                        console.log(err);
                        // TODO:
                        // notFound
                        // invalid
                        // conflict
                        promise.fail(errors.databaseError('Update error'));
                    }else{
                        var numberOfUpdatedDocs = result.result.nModified;
                        if(numberOfUpdatedDocs === 1){
                            promise.resolve();
                        }else if(numberOfUpdatedDocs === 0){
                            this.get(docid).then(function(){
                                promise.fail(errors.lockingError());
                            }).except(promise.fail);
                        }else{
                            promise.fail(errors.illegalState('More than one document updated'));
                        }

                    }
                }.bind(this));
            }else{
                docToStore.version = 0;
                db.collection(this.name).insert(docToStore, function(err, status){
                    if(err){
                        if(err.code === 11000){
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
 * Insert an array of documents
 */
Collection.prototype.insert = function(docs){
    var promise = new prom.Promise();

    _db(function(err, db){
        if(err){
            promise.fail(err);
        }else{
            var docsToStore = docs.map(function(doc){
                var docToStore = this._unwrap(doc);
                docToStore.lastModified = new Date().getTime();  // now, UTC
                return docToStore;
            }.bind(this));
            db.collection(this.name).insert(docs, function(err){
                if(err){
                    //console.error(err);
                    if(err.code === 11000){
                        promise.fail(errors.conflict('Duplicate key'));
                    }else{
                        promise.fail(errors.databaseError('Insert error'));
                    }
                }else{
                    promise.resolve();
                }
            });
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
