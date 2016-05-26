var gulp = require('gulp'),
    jshint = require('gulp-jshint');
    config = require('../config').serverScripts;

gulp.task('server-scripts', function(){
    return gulp.src(config.src)
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(gulp.dest(config.dst));
});
