/*
 * Definition of Error codes.
 * Preferred usage is through factory functions for predefined error types:
 * ```
 * return errors.databaseError('Connection error');
 * // OR
 * throw errors.invalid('Missing required field foo');
 * ```
 */

/*
 * Base class for all errors.
 *
 * code: suggested HTTP status code
 * name: unique name for the error
 * message: displayable message
 */
Exception = function(code, name, message){
    this.code = code;
    this.name = name;
    this.message = message || '';
};

module.exports.Exception = Exception;


module.exports.invalid = function(message){
    return new Exception(400, "ValidationError", message);
};

module.exports.unauthorized = function(message){
    return new Exception(401, "Unauthorized", message);
};


module.exports.forbidden = function(message){
    return new Exception(403, "Forbidden", message);
};


module.exports.badPassword = function(message){
    return new Exception(403, "BadPassword", message);
};


module.exports.notFound = function(message){
    return new Exception(404, 'NotFound', message);
};


module.exports.conflict = function(message){
    return new Exception(409, 'Conflict', message);
};


module.exports.lockingError = function(message){
    return new Exception(409, 'LockingError', message);
};


module.exports.databaseError = function(message){
    return new Exception(500, 'DatabaseError', message);
};


module.exports.illegalState = function(message){
    return new Exception(500, 'IllegalState', message);
};


module.exports.serviceError = function(message){
    return new Exception(500, 'ServiceError', message);
};
