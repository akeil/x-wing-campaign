var gulp = require('gulp');
var config = require('../config').data;

gulp.task('data', function(){
    return gulp.src(config.src)
        .pipe(gulp.dest(config.dst));
});
