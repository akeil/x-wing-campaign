var gulp = require('gulp');

gulp.task('clean-build', ['clean'], function(cb){
    gulp.start('build');
});

