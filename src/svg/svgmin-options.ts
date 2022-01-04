import { loadConfig, Plugin, DefaultPlugin, DefaultPlugins, OptimizeOptions, resolvePluginConfig, PresetDefault } from 'svgo';
import { deepCopy, entries } from '@upradata/util';
import { RequireOptions, requireModuleDefault } from '@upradata/node-util';


declare module 'svgo' {
    function resolvePluginConfig<P extends Plugin>(plugin: P): DefaultPlugin<P extends string ? P : P extends { name: string; } ? P[ 'name' ] : string>;
    interface OptimizedSvg {
        error?: string;
        modernError?: Error;
    }
}



// Plugin extends Plugin to distribute over Plugin
type ExtractPlugin<Plugin extends DefaultPlugins, Name extends string> = Plugin extends Plugin ? Plugin[ 'name' ] extends Name ? Plugin : never : never;


export type ObjectDefaultPlugins = {
    [ K in DefaultPlugins[ 'name' ] ]?: ExtractPlugin<DefaultPlugins, K>[ 'params' ] | boolean
};

export type ObjectCustomPlugins = Record<string, Exclude<Plugin, string>[ 'params' ] | boolean>;


type PluginType = 'only-object' | 'all';
export type ExtendedPlugins<Type extends PluginType = 'all'> = Type extends 'only-object' ?
    ObjectDefaultPlugins & ObjectCustomPlugins :
    OptimizeOptions[ 'plugins' ] | ObjectDefaultPlugins & ObjectCustomPlugins;

export type ExtendedOptimizedOptions<Type extends PluginType = 'all'> = Omit<OptimizeOptions, 'plugins'> & { plugins?: ExtendedPlugins<Type>; };


const toOptimizeOptions = (options: ExtendedOptimizedOptions): OptimizeOptions => {
    if (!options)
        return null;

    if (Array.isArray(options.plugins))
        return options as OptimizeOptions;


    const plugins = entries(options.plugins).map(([ k, v ]) => {
        if (typeof v === 'boolean') {
            return { name: k, active: v };
        }

        const plugin = { name: k, params: v, active: true };
        return plugin;
    });

    return { ...options, plugins: plugins as OptimizeOptions[ 'plugins' ] };
};


// To prevent multiple scans of the disk for a svgo.config.js file, keep its
// data in module scope.
const cache: { [ cwd: string ]: OptimizeOptions; } = {};


// Load the config from svgo.config.js or configFile
const loadConfigFromCache = async (configFile?: string, cwd?: string, tscOptions?: RequireOptions) => {
    if (configFile) {
        // Since svgmin allows a function to modify config per-file, we
        // want to prevent that function from making modifications to the
        // returned config object that would bleed into subsequent usages of
        // the config object.

        if (/\..?js/.test(configFile)) {
            // Look for the config in the specified file. loadConfig() will
            // require() the file, which caches it for us.
            return deepCopy(loadConfig(configFile, cwd));
        }

        return deepCopy(requireModuleDefault<OptimizeOptions>(configFile, tscOptions));
    }

    // Since no configFile was given, let loadConfig() find a file for us.

    // If the config file is not in our module cache, look for it on disk.
    if (!(cwd in cache)) {
        // Any usage of loadConfig() with the same cwd will return the same
        // file's config. Store the resulting config in our module cache.
        cache[ cwd ] = await loadConfig(null, cwd);
    }

    return cache[ cwd ];
};


const extendDefaultPlugins = (plugins: Plugin[]): PresetDefault => {
    return {
        name: 'preset-default',
        params: {
            overrides: {
                ...plugins.reduce((overrides, plugin) => {

                    const { name, params } = resolvePluginConfig(plugin);
                    return { ...overrides, [ name ]: params };

                }, {} as PresetDefault[ 'params' ][ 'overrides' ])
            }
        }
    };
};


export type SvgMinOptions<Type extends PluginType = 'all'> = ExtendedOptimizedOptions<Type> & {
    noOverride?: boolean;
    noExtendDefaultPlugins?: boolean;
    configFile?: string;
    cwd?: string;
    tscOptions?: RequireOptions;
};

export const getSvgoConfig = async (options: SvgMinOptions = null): Promise<OptimizeOptions> => {

    // Construct the svgo config from the given options.
    // Get the options that are for this plugin and not for svgo.
    const { noOverride = false, noExtendDefaultPlugins = false, configFile = null, cwd = process.cwd(), ...config } = options;
    const optimizeOptions = toOptimizeOptions(config);

    if (noOverride)
        return optimizeOptions;

    // Extract the svgo plugins list from the config as we will need to handle
    // them specially later.

    // Merge the given config with the config loaded from file. (If no
    // config file was found, svgo's toOptimizeOptions() returns null.)

    const optionsFromFileOrCache = toOptimizeOptions(await loadConfigFromCache(configFile, cwd)) || {};

    const mergedConfig = {
        ...optionsFromFileOrCache,
        ...optimizeOptions,
    };

    // Merge any plugins given in options.plugins
    const getPlugins = () => {
        if (optionsFromFileOrCache.plugins?.length > 0) {
            // If plugins are provided in a config file, they are assumed to be
            // a final list of plugins; according to svgo version 2 docs, the
            // config file is responsible for merging the default plugins list.
            // So we just need to merge the options.plugins into the list loaded
            // from the config file.
            return mergePlugins(optionsFromFileOrCache.plugins, optimizeOptions.plugins);
        }

        // Merge the default plugins list with options.plugins.
        if (!noExtendDefaultPlugins)
            return [ extendDefaultPlugins(mergedConfig.plugins) ];

    };


    if (mergedConfig.plugins)
        mergedConfig.plugins = getPlugins();

    return mergedConfig;
};


// Based on svgo's extendDefaultPlugins()
const mergePlugins = (plugins: Plugin[], overridePlugins: Plugin[]): Plugin[] => {
    const pluginName = (plugin: Plugin) => typeof plugin === 'string' ? plugin : plugin.name;

    const mergedPlugins = [ ...overridePlugins ];

    type PluginsIndex = { [ pluginName: string ]: number; };

    const pluginsIndex = plugins.reduce(
        (pluginsOrder, plugin, i) => ({ ...pluginsOrder, [ pluginName(plugin) ]: i }),
        {} as PluginsIndex
    );


    for (const plugin of overridePlugins) {
        const index = pluginsIndex[ pluginName(plugin) ];

        if (index === -1) {
            mergedPlugins.push(plugin);
        } else {
            mergedPlugins[ index ] = plugin;
        }
    }

    return mergedPlugins;
};
