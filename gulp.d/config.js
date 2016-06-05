var src = './src';
var dst = './build';
var www = dst + '/www';

module.exports = {
    dst: dst,
    data: {
        src: './data/**',
        dst: dst + '/data/'
    },
    img: {
        src: src + '/img/**',
        dst: www + '/img/'
    },
    htm: {
        src: src + '/htm/**/*.pug',
        dst: www,
        options: {
            pretty: ' '
        }
    },
    css: {
        src: src + '/css/**/*.css',
        dst: www + '/css/'
    },
    clientScripts: {
        src: src + '/js/client/**/*.js',
        dst: www + '/js/'
    },
    serverScripts: {
        src: src + '/js/+(server|common)/**/*.js',
        dst: dst + '/'
    },
    packageJSON: {
        src: './package.json',
        dst: dst + '/'
    },
    clean: {
        dst: dst
    },
    test: {
        options: {
            verbose: true,
            includeStackTrace: true
        },
        specs: src + '/spec/**/*-spec.js'
    }
};
