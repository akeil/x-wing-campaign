var gulp = require('gulp'),
    config = require('../config').scripts,
    jshint = require('gulp-jshint');

gulp.task('hint', function(){
    gulp.src(config.src)
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});
