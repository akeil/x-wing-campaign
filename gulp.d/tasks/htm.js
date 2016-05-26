var gulp = require('gulp'),
    config = require('../config').htm,
    pug = require('gulp-pug');

gulp.task('htm', function(){
    return gulp.src(config.src)
        .pipe(pug(config.options))
        .pipe(gulp.dest(config.dst));
});


