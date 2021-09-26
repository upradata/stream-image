import sharp from 'sharp';
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


export type ResponsiveFormat = 'jpeg' | 'jpg' | 'jpe' | 'png' | 'tiff' | 'webp' | keyof sharp.FormatEnum | sharp.AvailableFormatInfo;

export class ResponsiveConfig {
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
    sharpen: number | { sigma?: number; flat?: number; jagged?: number; } = undefined;
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
    rename: string;
    width: string;
    height: string;
}

type Config = Partial<ResponsiveConfig>;
export type ResponsiveConfigs = Arr<Config, 'mutable'> | ObjectOf<TT<Config, 'mutable'>>;

export const prepareConfig = (configs: ResponsiveConfigs, globalConfig: Config): (ResponsiveConfig & { matched?: boolean; })[] => {
    const mergeConfig = (config: Config, name: string) => {
        return { ...new ResponsiveConfig(), ...globalConfig, ...config, name };
    };

    const getConfig = (config: TT<Config, 'mutable'>, name: string): ResponsiveConfig[] => {
        return (Array.isArray(config) ? config : [ config ]).map(c => mergeConfig(c, name || c.name));
    };


    const isObject = isPlainObject(configs);

    return Object.entries(configs).flatMap(([ name, config ]) => getConfig(config, isObject ? name as string : undefined));
};



export class ResponsiveOptions extends ResponsiveConfig {
    errorOnUnusedConfig: boolean = true;
    errorOnUnusedImage: boolean = true;
    errorOnEnlargement: boolean = true;
    passThroughUnused: boolean = false;
    silent: boolean = false;
    stats: boolean = true;
}
