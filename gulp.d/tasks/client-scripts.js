var gulp = require('gulp'),
    config = require('../config').clientScripts,
    jshint = require('gulp-jshint'),
    browserify = require('browserify'),
    buffer = require('gulp-buffer'),
    transform = require('vinyl-transform'),
    uglify = require('gulp-uglify'),
    sourcemaps = require('gulp-sourcemaps'),
    tap = require('gulp-tap');
// from
// https://github.com/gulpjs/gulp/blob/master/docs/recipes/browserify-uglify-sourcemap.md
// https://github.com/gulpjs/gulp/blob/master/docs/recipes/browserify-multiple-destination.md
gulp.task('client-scripts', function(){
    var browserified = transform(function(filename){
        var b = browserify({
            entries: filename,
            debug: true
        });
        return b.bundle();
    });

    return gulp.src(config.src, {read: false})
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(tap(function(file){
            file.contents = browserify(file.path, {debug: true}).bundle();
        }))

        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        // .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(config.dst));

});
