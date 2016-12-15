import _ from 'lodash';
import async from 'async';

import gulp from 'gulp';
import babel from 'gulp-babel';
import sourcemaps from 'gulp-sourcemaps';
import uglify from 'gulp-uglify';
import plumber from 'gulp-plumber';

/* Rollup */
const rollup = require('rollup');
import rollupBabel from 'rollup-plugin-babel';

import del from 'del';
import gutil from 'gulp-util';
import runSequence from 'run-sequence';
import chalk from 'chalk';

import cache from 'gulp-cached';

import path from 'path';
import fs from 'fs';

import pjson from './package.json';

// Convenience function for copying files
// Returns an object with the following format
// {
//      src: String,
//      dest: String,
// }
//
// Usage:
//      copy('path/to/src.js').to('path/to/dest/js')
const copy = src => ({
    to: dest => ({
        src, dest
    })
});

const config = {
    src: [ 'src/**/*.js' ],

    // For debugging compiled code
    srcRoot: path.join(__dirname, 'src'),

    // Any additional files that should be copied over to dist/
    // Format:
    // {
    //      src: String, // relative path to the file from the project root
    //      dest: String, // destination path for the file
    // }
    copies: {
        production: [
            copy('package.json').to('dist/'),
            copy('README.md').to('dist/'),
            copy('LICENSE').to('dist/'),
        ],

        dev: [
            copy('package.json').to('dist/'),
            copy('README.md').to('dist/'),
            copy('LICENSE').to('dist/'),
        ],
    },

    // npm config stuff
    npm: {
        // Path to the npm entry file in src directory
        sourceEntry: './src/index.js',

        // Bundle output path, with the file name npm expects
        bundlePath: path.join('dist', pjson.main),
    },

    // Babel compilation options for rollup
    optsBabel: {
        babelrc: false,
        presets: [
          [ 'es2015', { modules: false } ]
        ],
    },
};

// Print nice, colorful errors
function mapError (err) {
    console.dir(err);
    console.log(err.stack);
    if (err.fileName) {
        // regular error
        return gutil.log(chalk.red(err.name)
            + ': '
            + chalk.yellow(err.fileName.replace(__dirname + '/src/', ''))
            + ': '
            + 'Line '
            + chalk.magenta(err.lineNumber)
            + ' & '
            + 'Column '
            + chalk.magenta(err.columnNumber || err.column)
            + ': '
            + chalk.blue(err.description));
    } else {
        // browserify error
        gutil.log(chalk.red(err.name)
            + ': '
            + chalk.yellow(err.message));
    }
}

// Log file watcher updates to console
function mapUpdate (evt) {
    let type = evt.type || 'updated';

    // For non-browserify events, the changed paths are in evt.path
    // For browserify events, evt is the changed paths
    // evt.path & path can either be a single path or an array of paths.
    let paths = _.flatten([ (evt.path || evt) ]);

    _.each(paths, (path) => {
        let shortenedPath = path.split('src').reduce((prev, current) => current);
        gutil.log(
            'File ' +
            chalk.green(shortenedPath) +
            ' was ' +
            chalk.blue(type) +
            '. Rebuilding...'
        );
    });
}

// Clean the dist directory
let clean = () => del([ 'dist/**', ]);
gulp.task('clean', clean);

// Convert es6 files to es5
gulp.task('babel:dev', (done) => {
    gulp.src(config.src)
        .pipe(plumber(mapError))
        .pipe(cache('babel:dev'))
        .pipe(sourcemaps.init())
        .pipe(babel())
        .pipe(sourcemaps.write('.', { sourceRoot: config.srcRoot }))
        .pipe(gulp.dest('dist/'))
        .on('end', done);
});

// Convert es6 files to es5, with minification
gulp.task('babel:production', (done) => {
    gulp.src(config.src)
        .pipe(plumber(mapError))
        .pipe(cache('babel:production'))
        .pipe(babel())
        .pipe(uglify())
        .pipe(gulp.dest('dist/'))
        .on('end', done);
});

// To cache the files for use by the watch task,
// the cache argument will be used as the key
// for the cache.
function copyFile (src, dest, cacheKey) {
    if (cacheKey) {
        return gulp
            .src(src)
            .pipe(cache(cacheKey))
            .pipe(gulp.dest(dest));
    } else {
        return gulp
            .src(src)
            .pipe(gulp.dest(dest));
    }
}

// Make copies of an array of { src, dest } objects.
// Calls cb (function cb (err) -> void) when done.
function copyAll (copies, cb) {
    async.each(
        copies,
        ({ src, dest }, next) => {
            copyFile(
                src,
                dest,
                src + dest
            ).on('end', next);
        },
        cb
    );
}

gulp.task('copies:dev', done => {
    copyAll(config.copies.dev, done);
});

gulp.task('copies:production', done => {
    copyAll(config.copies.production, done);
});

gulp.task('watch', () => {
    // Returns a stream that watches src for changes and runs task.
    // If isCached is true, removes deleted files from the cache
    // for that task.
    function watch ({ src, opts = {} }, task, isCached) {
        let watcher = gulp.watch(src, opts, [ task ]);
        watcher.on('change', mapUpdate);

        if (isCached) {
            watcher.on('change', (evt) => {
                // Remove delete scripts from the cache
                if (evt.type === 'deleted') {
                    delete cache.caches[ task ][ evt.path ];
                }
            });
        }
        return watcher;
    };

    // We don't need to return these.
    const watchBabel = watch({ src: config.src }, 'babel:dev', true);
    const watchCopies = _.map(
        config.copies.dev,
        ({ src }) => watch({ src }, 'copies:dev')
    );
});

// Bundle the application for distribution to npm
gulp.task('bundle:npm', done => {
    rollup.rollup({
        entry: config.npm.sourceEntry,

        // Don't combine npm deps
        external: _.keys(pjson.dependencies),

        // Use babel
        plugins: [
          rollupBabel(config.optsBabel),
        ],
    }).then(bundle => {
        // bundle with CommonJS es5 output
        // write to dist
        return bundle.write({
            format: 'cjs',
            dest: config.npm.bundlePath,
        });
    }).then(() => {
        return done();
    }).catch(err => {
        return done(err);
    })
});

// Prepare the already-built dist directory for publishing to npm.
gulp.task('pack', done => {
    // Remove dev stuff from package.json
    const npmPackage = _.omit(
        pjson,
        [ 'devDependencies', 'scripts' ]
    );

    // Update package.json in the dist/ directory
    fs.writeFile('dist/package.json', JSON.stringify(npmPackage, null, '  '), 'utf-8', done);
});

gulp.task('dev', (done) => {
    runSequence(
        'clean',
        [ 'copies:dev', 'babel:dev' ],
        'watch',
        done
    );
});

gulp.task('production', done => {
    runSequence(
        'clean',
        [ 'copies:production', 'bundle:npm' ],
        'pack',
        done
    );
});

gulp.task('default', [ 'production' ]);
