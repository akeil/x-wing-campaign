var gulp = require('gulp'),
    config = require('../config').css,
    less = require('gulp-less'),
    cleanCSS = require('gulp-clean-css');

gulp.task('css', function(){
    return gulp.src(config.src)
        .pipe(less({paths: [
            '.',
            './node_modules/bootstrap-less',
        ]}))
        .pipe(cleanCSS())
        .pipe(gulp.dest(config.dst));
});

