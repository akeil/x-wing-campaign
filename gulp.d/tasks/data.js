var gulp = require('gulp'),
    tap = require('gulp-tap'),
    path = require('path'),
    through = require('through2');
var config = require('../config').data;

gulp.task('data', function(){
    return gulp.src(config.src)
        .pipe(tap(function(file, t){
            // dir structure:
            //  data/
            //    file2.json
            //    file2.json
            //    upgrades/
            //      interesting-files.json
            var dirname = path.dirname(file.path);
            var ext = path.extname(file.path);
            if(dirname.lastIndexOf('/upgrades') > 0 && ext === '.json'){
                var items = JSON.parse(file.contents.toString('utf8'));
                var slot = path.basename(file.path, '.json');
                // special case for crew-xxx files
                if(slot.lastIndexOf('crew-', 0) === 0){
                    slot = 'crew';
                }
                var converted = items.map(function(item){
                    return {
                        name: item.canonical,
                        slot: slot,
                        displayName: item.name,
                        cost: item.cost || 0,
                        description: '',
                        unique: item.unique ? true : false
                    };
                });
                file.contents = new Buffer(JSON.stringify(converted));
            }
        }))
        .pipe(gulp.dest(config.dst));
});
