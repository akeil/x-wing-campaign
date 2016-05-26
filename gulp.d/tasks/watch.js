var gulp = require('gulp'),
    config = require('../config');

gulp.task('watch', function(callback) {
    gulp.watch(config.scripts.src, ['scripts']);
    gulp.watch(config.css.src, ['css']);
    gulp.watch(config.img.src, ['img']);
    gulp.watch(config.htm.src, ['htm']);
});

