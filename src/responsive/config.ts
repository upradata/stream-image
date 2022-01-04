import sharp from 'sharp';
import * as rename from 'gulp-rename';
import { Arr, isPlainObject, ObjectOf, TT } from '@upradata/util';
/*
Configuration unit is an object:

* name: String - filename glob pattern
* width: Number - not set by default
* height: Number - not set by default
* withoutEnlargement: Boolean - default true
* skipOnEnlargement: Boolean - default false
* rename: String - new file name, file will not be renamed by dafault

Configuration can be provided in one of the following formats:

1. Array of unique configurations

[{
  name: 'logo.png',
  width: 200,
  height: 100
},{
  name: 'banner.png',
  width: 500
}]

2. Object of unique configurations. Keys are names of files.

{
  'logo.png': {
    width: 300,
    height: 200,
    raname: 'logo@2x.png'
  },
  'background-*.png': {
    width: 1400,
    withoutEnlargement: true
  }
}

3. Object of array of unique configurations. Keys are names of files.

{
  'logo.png': [{
      width: 200,
      raname: 'logo@1x.png'
    },{
      width: 400,
      rename: 'logo@2x.png'
    }],
  'background-*': [{
    height: 400
  }]
}

*/

export type Rename = string | rename.Options | ((path: rename.ParsedPath) => any);

export type ResponsiveFormat = 'jpeg' | 'jpg' | 'jpe' | 'png' | 'tiff' | 'webp' | keyof sharp.FormatEnum | sharp.AvailableFormatInfo;

export class ResponsiveImageOptions {
    crop: 'entropy' | 'attention' | string | number = undefined;
    embed: boolean = false;
    min: boolean = false;
    max: boolean = false;
    withoutEnlargement: boolean = true;
    skipOnEnlargement: boolean = false;
    ignoreAspectRatio: boolean = false;
    kernel: 'nearest' | 'cubic' | 'mitchell' | 'lanczos2' | 'lanczos3' = 'lanczos3';
    extractBeforeResize: sharp.Region = undefined;
    extractAfterResize: sharp.Region = undefined;
    background: string = '#fff';
    flatten: boolean = false;
    negate: boolean = false;
    rotate: boolean = false;
    flip: boolean = false;
    flop: boolean = false;
    blur: boolean = false;
    sharpen: number | boolean | { sigma?: number; flat?: number; jagged?: number; } = true;
    threshold: number = undefined;
    gamma: boolean = false;
    grayscale: boolean = false;
    normalize: boolean = false;
    quality: number = 6;
    progressive: boolean = false;
    withMetadata: sharp.WriteableMetadata = undefined;
    tile: sharp.TileOptions | boolean = undefined;
    chromaSubsampling?: string = undefined;
    withoutChromaSubsampling: boolean = false;
    compressionLevel: number = 6;
    format: ResponsiveFormat;
    trim: number = undefined;
    name: string;
    rename: Rename;
    width: number;
    height: number;
}

export type ResponsiveImageOpts = Partial<ResponsiveImageOptions>;
export type ResponsiveImageConfig = Arr<ResponsiveImageOpts, 'mutable'> | ObjectOf<TT<ResponsiveImageOpts, 'mutable'>>;

export const prepareConfig = (configs: ResponsiveImageConfig, globalConfig: ResponsiveImageOpts): (ResponsiveImageOptions & { matched?: boolean; })[] => {
    const mergeConfig = (config: ResponsiveImageOpts, name: string) => {
        return { ...new ResponsiveImageOptions(), ...globalConfig, ...config, name };
    };

    const getConfig = (config: TT<ResponsiveImageOpts, 'mutable'>, name: string): ResponsiveImageOptions[] => {
        return (Array.isArray(config) ? config : [ config ]).map(c => mergeConfig(c, name || c.name));
    };


    const isObject = isPlainObject(configs);

    return Object.entries(configs).flatMap(([ name, config ]) => getConfig(config, isObject ? name as string : undefined));
};



export class ResponsiveOptions /* extends ResponsiveImageOnlyOptions */ {
    errorOnUnusedConfig: boolean = true;
    errorOnUnusedImage: boolean = true;
    errorOnEnlargement: boolean = true;
    passThroughUnused: boolean = false;
    silent: boolean = false;
    stats: boolean = true;
}

export type ResponsiveOpts = Partial<ResponsiveOptions>;
