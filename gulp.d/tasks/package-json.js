var gulp = require('gulp'),
    config = require('../config').packageJSON;

gulp.task('package-json', function(){
    return gulp.src(config.src)
        .pipe(gulp.dest(config.dst));
});

