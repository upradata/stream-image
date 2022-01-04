import path from 'path';
import PluginError from 'plugin-error';
import rename from 'rename';
import sharp from 'sharp';
import VinylFile from 'vinyl';
import { green, red, yellow } from '@upradata/node-util';
import { ensureArray } from '@upradata/util';
import { ResponsiveImageOptions, ResponsiveOptions } from './config';
import format from './format';
import size from './size';


const PLUGIN_NAME = 'Responsive';

export default async function (file: Omit<VinylFile, 'contents'> & { contents: Buffer; }, config: ResponsiveImageOptions, options: ResponsiveOptions) {
    const errPrefix = `File "${file.relative}": `;
    const image = sharp(file.contents);

    try {
        const metadata = await image.metadata();

        const filePath = config.rename ?
            path.join(file.base, rename(file.relative, config.rename) as string) :
            file.path;

        const width = size(config.width, metadata.width);
        const height = size(config.height, metadata.height);

        if (width || height) {
            if (config.withoutEnlargement && (width > metadata.width || height > metadata.height)) {
                let message = `${errPrefix}Image enlargement is detected`;

                if (width) {
                    message += `\n real width: ${metadata.width}px, required width: ${width}px`;
                }

                if (height) {
                    message += `\n  real height: ${metadata.height}px, required height: ${height}px`;
                }

                if (options.errorOnEnlargement) {
                    throw new PluginError(PLUGIN_NAME, message);
                }

                if (config.skipOnEnlargement) {
                    if (!options.silent) {
                        console.log(red`${PLUGIN_NAME}: (skip for processing): ${message}`);
                    }
                    // passing a null file to the callback stops a new image being added to the pipeline for this config
                    return null;
                }

                if (!options.silent) {
                    console.log(yellow`${PLUGIN_NAME}: (skip for enlargement): ${message}`);
                }
            }
        }


        if (config.extractBeforeResize) {
            image.extract(config.extractBeforeResize);
        }

        image.resize(width, height, {
            background: config.background,
            kernel: config.kernel,
            withoutEnlargement: config.withoutEnlargement
        });

        if (config.extractAfterResize) {
            image.extract(config.extractAfterResize);
        }

        if (config.crop) {
            if (config.crop === 'entropy') {
                image.resize(width, height, { fit: 'cover', position: sharp.strategy.entropy }); // crop
            } else if (config.crop === 'attention') {
                image.resize(width, height, { fit: 'cover', position: sharp.strategy.attention }); // crop
            } else {
                image.resize(width, height, { fit: 'cover', position: config.crop }); // crop
            }
        }

        if (config.embed) {
            image.resize(width, height, { fit: 'contain' }); // embed;
        }

        if (config.max) {
            image.resize(width, height, { fit: 'inside' }); // max
        }

        if (config.flatten) {
            image.flatten({
                background: config.background
            });
        }

        image.negate(config.negate);

        if (config.trim) {
            image.trim(config.trim);
        }

        if (config.min) {
            image.resize(width, height, { fit: 'outside' }); // min
        }

        if (config.ignoreAspectRatio) {
            console.warn(`Sharp: ignoreAspectRatio is deprecated and will not be used`);
            // image.ignoreAspectRatio();
        }

        image.flatten(config.flatten);
        image.negate(config.negate);

        if (config.rotate !== false) {
            if (typeof config.rotate === 'boolean') {
                image.rotate();
            } else {
                image.rotate(config.rotate);
            }
        }

        image.flip(config.flip);
        image.flop(config.flop);
        image.blur(config.blur);

        if (config.sharpen) {
            if (typeof config.sharpen === 'number')
                image.sharpen(config.sharpen);
            else if (typeof config.sharpen === 'boolean')
                image.sharpen();
            else
                image.sharpen(config.sharpen.sigma, config.sharpen.flat, config.sharpen.jagged);
        }

        image.threshold(config.threshold);

        if (config.gamma !== false) {
            if (typeof config.gamma === 'boolean') {
                image.gamma();
            } else {
                image.gamma(config.gamma);
            }
        }

        image.grayscale(config.grayscale);
        image.normalize(config.normalize);
        image.withMetadata(config.withMetadata);
        image.tile(config.tile as sharp.TileOptions);

        if (config.withoutChromaSubsampling) {
            config.chromaSubsampling = '4.4.4';
        }

        const imageFormat = config.format || format(filePath);

        const getClone = () => {
            const clone = image.clone();

            switch (imageFormat) {
                case 'jpeg':
                case 'jpg':
                case 'jpe':
                    return clone.jpeg(config);
                case 'png':
                    return clone.png(config);
                case 'webp':
                    return clone.webp(config);
                case 'tiff':
                    return clone.tiff({ tile: config.tile as boolean });
                case 'unsupported': throw new Error('Unsupported format');
                default:
                    return clone.toFormat(imageFormat, config);
            }
        };

        const clone = getClone();

        const buffer = await clone.toBuffer();

        const newFile = new VinylFile({
            cwd: file.cwd,
            base: file.base,
            path: filePath,
            contents: buffer
        });

        newFile.extname = `.${imageFormat}`;

        if (!options.silent) {
            console.log(green`${PLUGIN_NAME}: ${file.relative} -> ${newFile.relative}`);
        }

        return newFile;

    } catch (error) {
        throw new PluginError(PLUGIN_NAME, errPrefix + error.message, { showStack: true });
    }
}
