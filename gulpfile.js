/*
 * Each task is kept in its own file under gulp.d/taks/
 */
var reqdir = require('require-dir');

// load tasks from gulp/tasks
reqdir('./gulp.d/tasks', {recurse: true});

