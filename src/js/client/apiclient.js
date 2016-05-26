var promise = require('../common/promise');


/*
 * API client
 */
Client = function(){
    this.baseurl = '/api';
};

/*
 * TODO replace with something useful
 */
Client.prototype.foo = function(){
    return this._promise(
        'GET',
        '/foo'
    );
};


// more API calls here


Client.prototype._promise = function(method, endpoint, payload){
    var url = this.baseurl + endpoint;
    var prom = new promise.Promise();
    var req = new XMLHttpRequest();

    req.open(method, url, true);

    req.addEventListener(
        'error',
        function(){
            console.log('HTTP ' + req.status + ' for ' + url);
            console.log(req.response);
            var result;
            if(req.responseText){
                result = JSON.parse(req.responseText);
            }
            prom.fail(result);
        },
        false
    );

    req.addEventListener(
        'load',
        function(){
            console.log('HTTP ' + req.status + ' for ' + url);
            console.log(req.responseText);
            var result;
            if(req.responseText){
                result = JSON.parse(req.responseText);
            }
            prom.resolve(result);
        }, false
    );

    console.log(method + ' ' + url);

    if(payload){
        payload = JSON.stringify(payload);
        req.setRequestHeader('Content-Type', 'application/json');
        console.log('payload: ' + payload);
        req.send(payload);
    }else{
        req.send();
    }

    return prom;
};


exports.Client = Client;
