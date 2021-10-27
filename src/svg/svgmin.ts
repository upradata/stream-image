import PluginError from 'plugin-error';
import stream from 'stream';
import { optimize } from 'svgo';
import through from 'through2';
import VinylFile from 'vinyl';
import { TT$, isUndefined } from '@upradata/util';
import { getSvgoConfig, SvgMinOptions } from './svgmin-options';

const PLUGIN_NAME = 'SvgMin';

export type SvgMinOpts = SvgMinOptions | ((file: VinylFile) => TT$<SvgMinOptions>);

export const svgMinTransform = (options?: SvgMinOpts) => {

    const isOptionsFunction = typeof options === 'function';

    return through.obj(async (file: VinylFile, encoding: string, cb: stream.TransformCallback) => {
        if (file.isStream()) {
            return cb(new PluginError(PLUGIN_NAME, 'Streaming not supported'));
        }

        if (file.isNull()) {
            return cb(null, file);
        }

        try {

            const config = await getSvgoConfig(
                isOptionsFunction ? await options(file) : options,
                isOptionsFunction
            );

            const { data, error, modernError } = optimize(String(file.contents), config);

            const e = error || modernError;

            if (e || isUndefined(data))
                throw e;

            // Ignore svgo meta data and return the SVG string.

            file.contents = Buffer.from(data);
            return cb(null, file);

        } catch (e) {
            cb(new PluginError(PLUGIN_NAME, e));
        }

    });
};
