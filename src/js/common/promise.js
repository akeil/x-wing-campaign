/*
 * Promise
 */
var PENDING = 0;
var SUCCESS = 1;
var FAILED = -1;


Promise = function(){
    this._status = PENDING;
    this._successCb = null;
    this._errorCb = null;
    this._result = null;
};

Promise.prototype.then = function(callback){
    this._successCb = callback;
    if(this._status === SUCCESS){
        this._invokeCallback();
    }
    return this;
};

Promise.prototype.except = function(callback){
    this._errorCb = callback;
    if(this._status === FAILED){
        this._invokeCallback();
    }
    return this;
};

Promise.prototype.resolve = function(payload){
    if(this._status === PENDING){
        this._result = payload;
        this._status = SUCCESS;
        this._invokeCallback();
    }
};

Promise.prototype.fail = function(payload){
    if(this._status === PENDING){
        this._result = payload;
        this._status = FAILED;
        this._invokeCallback();
    }
};

Promise.prototype._invokeCallback = function(){
    if(this._status === SUCCESS){
        if(this._successCb){
            this._successCb(this._result);
        }
    }else if(this._status === FAILED){
        if(this._errorCb){
            this._errorCb(this._result);
        }
    }
};


exports.Promise = Promise;
