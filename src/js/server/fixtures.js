/*
 * Static data to be inserted once after installation.
 */
 var fs = require('fs'),
     model = require('../common/model'),
     store = require('./store');


module.exports.initAll = function(datapath, callback){
    _initShips(datapath, function(err){
        if(err){
            callback(err);
        }else{
            _initUpgrades(datapath, function(err){
                if(err){
                    callback(err);
                }else{
                    _initMissions(datapath, function(err){
                        if(err){
                            callback(err);
                        }else{
                            _initAdminAccount(callback);
                        }
                    });
                }
            });
        }
    });
};


var _initAdminAccount = function(callback){
    var admin = model.NewUser({
        name: 'admin',
        displayName: 'Admin',
        pwHash: '$2a$10$dFrFIN7Q3oyQOefm57Hia.i4RtVed.VffmK1QQc8E0HHfiD5eW2B2'
    });
    store.users.put(admin).then(function(unused){
        callback();
    }).except(function(err){
        if(err.name === 'Conflict'){
            callback();
        }else{
            callback(err);
        }
    });
};


var _initShips = function(datapath, callback){
    var path = datapath + '/ships.json';
    fs.readFile(path, function(err, contents){
        if(err){
            callback(err);
        }else{
            var items = JSON.parse(contents);
            console.log('insert fixtures from ' + path);
            store.ships.insert(items).then(callback).except(function(err){
                if(err.name === 'Conflict'){
                    callback();
                }else{
                    callback(err);
                }
            });
        }
    });
};


var _initUpgrades = function(datapath, callback){
    var path = datapath + '/upgrades';
    var fileCount = 0;  // control when to invoke final cb
    var hasError = false;  //  control that cb is only called once on error

    // one file, async
    var oneFile = function(err, contents){
        if(err){
            if(!hasError){
                hasError = true;
                callback(err);
            }
        }else{
            var items = JSON.parse(contents);
            store.upgrades.insert(items).then(function(){
                fileCount--;
                if(fileCount === 0){
                    callback();
                }
            }).except(function(err){
                fileCount--;
                if(err.name === 'Conflict'){
                    if(fileCount === 0){
                        callback();
                    }
                }else if(!hasError){
                    hasError = true;
                    callback(err);
                }
            });
        }
    };

    fs.readdir(path, function(err, files){
        fileCount = files.length;
        for(var i = 0; i < files.length; i++) {
            if(err){
                callback(err);
            }else{
                console.log('insert fixtures from ' + path + '/' + files[i]);
                fs.readFile(path + '/' + files[i], oneFile);
            }
        }
    });
};


var _initMissions = function(datapath, callback){
    var path = datapath + '/missions.json';
    fs.readFile(path, function(err, contents){
        if(err){
            callback(err);
        }else{
            var items = JSON.parse(contents);
            console.log('insert fixtures from ' + path);
            store.missions.insert(items).then(callback).except(function(err){
                if(err.name === 'Conflict'){
                    callback();
                }else{
                    callback(err);
                }
            });
        }
    });
};
