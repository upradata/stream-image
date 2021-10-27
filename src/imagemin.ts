// copy from npm imagemin/lib/index.js

import imagemin from 'imagemin';
import path from 'path';
import PluginError from 'plugin-error';
import prettyBytes from 'pretty-bytes';
import stream from 'stream';
import through from 'through2-concurrent';
import VinylFile from 'vinyl';
import { gray, green, yellow } from '@upradata/node-util';


const loadPlugin = (plugin: string, ...args: any[]) => {
    try {
        // eslint-disable-next-line global-require
        return require(`imagemin-${plugin}`)(...args);
    } catch (error) {
        console.log(`${ImageMinTransform.name}: Couldn't load default plugin "${plugin}"`);
    }
};

const exposePlugin = (plugin: string) => (...args: any[]) => loadPlugin(plugin, ...args);

export class ImageMinOptions {
    plugins: (imagemin.Plugin | string)[] = [ 'gifsicle', 'jpegtran', 'optipng', 'svgo' ];
    validExtensions: string[] = [ '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp' ];
    verbose: boolean = false;
    title: string = '';
}

export class ImageMinTransform {
    static gifsicle = exposePlugin('gifsicle');
    static jpegtran = exposePlugin('jpegtran');
    static optipng = exposePlugin('optipng');
    static svgo = exposePlugin('svgo');


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

    get plugins(): imagemin.Plugin[] {
        const plugins: imagemin.Plugin[] = [];

        for (const plugin of this.options.plugins) {
            if (typeof plugin === 'string') {
                const instance = loadPlugin(plugin);
                if (instance)
                    plugins.push(instance);
            } else
                plugins.push(plugin);
        }

        return plugins;
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

    private transform(stream: stream.Transform, file: VinylFile, encoding: string, cb: stream.TransformCallback) {

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

        imagemin.buffer(fileBuffer.contents, { plugins: this.plugins })
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
