import path from 'path';
import PluginError from 'plugin-error';
import stream from 'stream';
import svg2img, { svg2imgOptions } from 'svg2img';
import through from 'through2';
import { promisify } from 'util';
import VinylFile from 'vinyl';
import { SvgDimension } from './svg-dimension';


// export type Format = svg2imgOptions[ 'format' ];
export enum Format {
    jpeg = 'jpeg',
    jpg = 'jpg',
    png = 'png',
}

export class Svg2ImgOptions {
    width?: number = 100;
    height?: number;
    scale?: number = 1;
    preserveAspectRatio?: boolean = true;
    format?: Format = Format.png;
}


class Svg2Img {
    public pluginName = this.constructor.name;
    public options: Svg2ImgOptions;

    constructor(options?: Partial<Svg2ImgOptions>) {
        this.options = Object.assign(new Svg2ImgOptions(), options);
    }

    run(options?: Partial<Svg2ImgOptions>): stream.Transform {
        const opts = Object.assign(this.options, options);

        const throughOptions = { objectMode: true };
        const self = this;

        return through(throughOptions, function (file: VinylFile, encoding: string, cb: stream.TransformCallback) {
            return self.transform(opts, this, file, encoding, cb);
        });
    }


    private async transform(options: Svg2ImgOptions, stream: stream.Transform, file: VinylFile, encoding: string, cb: stream.TransformCallback) {
        if (file.isStream()) {
            return cb(new PluginError(this.pluginName, 'Streaming not supported'));
        }

        if (file.isNull()) {
            return cb(null, file);
        }

        const opts = await this.processOptions(file, options);
        this.transformGulpSvg2Img(file, opts, cb);
    }

    private async processOptions(file: VinylFile, options: Svg2ImgOptions) {

        const { width, height } = await new SvgDimension().dimension({ path: file.path, mode: 'auto' });
        const opts = { ...options };

        // with a ternaty condition, if no parenthesis, the expression is still executed even though opts.width returns
        if (opts.preserveAspectRatio) {
            if (!opts.width)
                opts.width = width / height * opts.height;

            if (!opts.height)
                opts.height = height / width * opts.width;
        }

        if (opts.scale) {
            opts.width *= opts.scale;
            opts.height *= opts.scale;
        }

        return opts;
    }


    private async transformGulpSvg2Img(file: VinylFile, options: Svg2ImgOptions, cb: stream.TransformCallback) {
        try {
            const svg2img$ = promisify<string, svg2imgOptions, Buffer>(svg2img);
            const buffer: Buffer = await svg2img$(file.path, options);

            const { name: fileNameNoExt, dir } = path.parse(file.path);
            const ext = options.format || 'png';
            const fileDestination = path.join(dir, `${fileNameNoExt}.${ext}`);

            // Update path for file so this path is used later on
            file.path = fileDestination;
            file.contents = buffer;
            cb(null, file);
        } catch (err) {
            return cb(new PluginError('gulp-svg2img', `Could not convert file <${file.path}>: ${err.message}`));
        }
    }
}


export function svg2Img(options?: Partial<Svg2ImgOptions>) {
    return new Svg2Img(options).run();
}