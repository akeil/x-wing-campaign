var gulp = require('gulp'),
    config = require('../config').tests,
    jasmine = require('gulp-jasmine'),
    notify = require('gulp-notify');

gulp.task('test', function(){
    gulp.src(config.specs)
        .pipe(jasmine(config.options))
        .on('error', notify.onError({
            title: 'Test failed',
            message: 'One or more tests for failed'
        }));
});

