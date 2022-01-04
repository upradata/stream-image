// copy from npm imagemin/lib/index.js

import type * as imagemin from 'imagemin';
import path from 'path';
import PluginError from 'plugin-error';
import prettyBytes from 'pretty-bytes';
import stream from 'stream';
import through from 'through2-concurrent';
import VinylFile from 'vinyl';
import { gray, green, yellow, styles as s } from '@upradata/node-util';
import { TT$ } from '@upradata/util';
import { SvgMinOptions, getSvgoConfig } from './svg';

export type ImageMinPlugin = (...configs: any[]) => imagemin.Plugin;


const requirePlugin = async (pluginName: string): Promise<ImageMinPlugin> => {
    try {
        // eslint-disable-next-line global-require
        const plugin: ImageMinPlugin = (await import(`imagemin-${pluginName}`).catch(_e => import(pluginName))).default;
        return plugin;

    } catch (error) {
        console.warn(s.bold.args.yellow.$`${ImageMinTransform.name}: Couldn't load default plugin "${pluginName}"`);
        return undefined;
    }
};


const loadPlugin = async (plugin: TT$<ImageMinPlugin>, ...configs: any[]) => (await plugin)(...configs);



export class ImageMinOptions {
    plugins: (TT$<imagemin.Plugin> | string)[] = [ 'gifsicle', 'jpegtran', 'optipng', 'svgo' ];
    validExtensions: string[] = [ '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp' ];
    verbose: boolean = false;
    title: string = '';
}


export class ImageMinTransform {
    static gifsicle = (config: import('imagemin-gifsicle').Options) => loadPlugin(requirePlugin('gifsicle'), config);
    static jpegtran = (config: import('imagemin-jpegtran').Options) => loadPlugin(requirePlugin('jpegtran'), config);
    static mozjpeg = (config: import('imagemin-mozjpeg').Options) => loadPlugin(requirePlugin('mozjpeg'), config);
    static optipng = (config: import('imagemin-optipng').Options) => loadPlugin(requirePlugin('optipng'), config);
    static pngquant = (config: import('imagemin-pngquant').Options) => loadPlugin(requirePlugin('pngquant'), config);
    static webp = (config: import('imagemin-webp').Options) => loadPlugin(requirePlugin('webp'), config);
    static svgo = async (config: SvgMinOptions) => loadPlugin(requirePlugin('svgo'), await getSvgoConfig(config));


    public readonly pluginName = this.constructor.name;
    public options: ImageMinOptions;
    private used: boolean = false;

    public readonly stats = {
        total: 0,
        savedBytes: 0,
        files: 0
    };


    constructor(options?: Partial<ImageMinOptions>) {
        this.options = Object.assign(new ImageMinOptions(), options);
    }

    async plugins() {

        const loadedPlugins = await Promise.all(this.options.plugins.map(async plugin => {
            if (typeof plugin === 'string') {
                const instance = await loadPlugin(requirePlugin(plugin));
                return instance;
            }

            return plugin;
        }));

        return loadedPlugins.filter(v => !!v);
    }

    create() {
        if (this.used)
            throw new Error(`${this.pluginName} Error: run can be used only once.`);

        const throughOptions = { objectMode: true, maxConcurrency: 8 };
        const self = this;

        return through(throughOptions,
            function (file: VinylFile, encoding: string, cb: stream.TransformCallback) {
                return self.transform(this, file, encoding, cb);
            },
            function (cb: stream.TransformCallback) { return self.flush(this, cb); }
        );
    }

    private async transform(stream: stream.Transform, file: VinylFile, encoding: string, cb: stream.TransformCallback) {

        if (file.isStream()) {
            return cb(new PluginError(this.pluginName, 'Streaming not supported'));
        }

        if (file.isNull()) {
            return cb(null, file);
        }


        if (!this.options.validExtensions.includes(path.extname(file.path).toLowerCase())) {
            if (this.options.verbose)
                console.log(yellow`${this.pluginName}: Skipping unsupported image file extension ${file.relative}`);


            cb(null, file);
            return;
        }


        // just for Typescript file.contents typing => for sure it is a buffer here
        const fileBuffer = file as VinylFile.BufferFile;

        // now imagemin is a ESM module. Like I handle both CJS and ESM, I dynamic import it (supported in both)
        const imagemin = (await import('imagemin')).default;

        imagemin.buffer(fileBuffer.contents, { plugins: await this.plugins() })
            .then(data => {
                const originalSize = fileBuffer.contents.length;
                const optimizedSize = data.length;
                const saved = originalSize - optimizedSize;
                const percent = originalSize > 0 ? (saved / originalSize) * 100 : 0;
                const savedMsg = `saved ${prettyBytes(saved)} - ${percent.toFixed(1).replace(/\.0$/, '')}%`;
                const msg = saved > 0 ? savedMsg : 'already optimized';

                if (saved > 0) {
                    this.stats.total += originalSize;
                    this.stats.savedBytes += saved;
                    this.stats.files++;
                }

                if (this.options.verbose)
                    console.log(`${this.pluginName} -> ${green`${this.options.title}`}: ${green`✔ `} ${file.relative} ${gray`${msg}`}`);

                file.contents = data;
                cb(null, file);
            })
            .catch(error => {
                cb(new PluginError(this.pluginName, error, { fileName: file.path }));
            });
    }

    private flush(stream: stream.Transform, cb: stream.TransformCallback) {
        const { total, savedBytes, files } = this.stats;

        const percent = total > 0 ? (savedBytes / total) * 100 : 0;
        let msg = `Minified images: ${files}`;

        if (total > 0) {
            msg += gray` (saved ${prettyBytes(savedBytes)} - ${percent.toFixed(1).replace(/\.0$/, '')}%)`;
        }

        console.log(`${this.pluginName} -> ${green`${this.options.title}`}:`, msg);
        cb();
    }
}


export function imageMinTransform(options?: Partial<ImageMinOptions>) {
    return new ImageMinTransform(options).create();
}
