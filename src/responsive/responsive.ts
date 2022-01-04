import minimatch from 'minimatch';
import PluginError from 'plugin-error';
import through2 from 'through2';
import { green, magenta, white, oneLine } from '@upradata/node-util';
import { prepareConfig, ResponsiveOptions, ResponsiveImageConfig, ResponsiveOpts } from './config';
import sharpVinyl from './sharp';


const PLUGIN_NAME = 'Responsive';


export function responsiveTransform(config: ResponsiveImageConfig, opts: ResponsiveOpts) {
    const plur$ = import('plur').then(m => m.default);

    const statistics = {
        total: 0,
        matched: 0,
        created: 0,
        unmatched: 0,
        unmatchedBlocked: 0,
        unmatchedPassed: 0
    };

    const options = { ...new ResponsiveOptions(), ...opts };


    const configs = prepareConfig(config || [], {});

    return through2.obj(async function (file, _enc, done) {

        if (file.isNull()) {
            this.push(file);
            return done();
        }

        if (file.isStream()) {
            return done(new PluginError(PLUGIN_NAME, 'Streaming not supported'));
        }

        statistics.total++;

        const matchedConfigs = configs.filter(conf => minimatch(file.relative, conf.name));

        if (matchedConfigs.length === 0) {
            statistics.unmatched++;

            const message = `File "${file.relative}": Image does not match any config`;

            if (options.errorOnUnusedImage)
                return done(new PluginError(PLUGIN_NAME, message));

            if (options.passThroughUnused) {
                this.push(file);
                statistics.unmatchedPassed++;

                if (!options.silent) {
                    console.log(magenta`${PLUGIN_NAME} ': (pass through without changes)`);
                }

                return done();
            }

            statistics.unmatchedBlocked++;

            if (!options.silent) {
                console.log(magenta`${PLUGIN_NAME}: (skip for processing)`);
            }

            return done();
        }

        statistics.matched++;

        try {
            const files = await Promise.all(matchedConfigs.map(conf => {
                // config item matched (can be matched multiple times)
                conf.matched = true;
                // there is an error in sharpVinyl typing where options is ResponsiveImageOptions instead of ResponsiveOptions
                return sharpVinyl(file, conf, options as any);
            }));


            for (const newFile of files) {
                if (newFile) {
                    this.push(newFile);
                    statistics.created++;
                }
            }

            done();

        } catch (e) {
            done(e);
        }

    }, async cb => {
        const plur = await plur$;

        const notMatched = configs.filter(conf => !conf.matched);

        if (options.stats && !(options.silent && statistics.created === 0)) {
            const msg = oneLine`
                Created ${statistics.created} ${plur('image', statistics.created)}
                ${white` (matched ${statistics.matched} of ${statistics.total} ${plur('image', statistics.total)})`}`;

            console.log(green`${PLUGIN_NAME}: ${msg}`);
        }

        if (notMatched.length > 0 && (!options.silent || options.errorOnUnusedConfig)) {
            const message = `Available images do not match the following config: ${notMatched.map(conf => `  - "${conf.name}"`).join('\n')}`;

            if (options.errorOnUnusedConfig) {
                return cb(/* new PluginError(PLUGIN_NAME, message) */);
            }

            console.log(magenta`${PLUGIN_NAME}: ${message}`);

        }

        cb();
    });
}
