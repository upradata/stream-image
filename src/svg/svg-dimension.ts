import fs from 'fs-extra';
import * as svgson from 'svgson';
import { Svg } from './svg';


export type DimensionMode = 'auto' | 'widthAndHeight' | 'viewbox';
export interface Dimension {
    width: number;
    height: number;
}

export class SvgDimensionOptions {
    path: string;
    mode?: DimensionMode = 'auto';

    constructor(options: Partial<SvgDimensionOptions>) {
        Object.assign(this, options);
    }
}

export class SvgDimension {

    constructor() { }


    async dimension(options: SvgDimensionOptions): Promise<Dimension> {
        const { path, mode } = new SvgDimensionOptions(options);

        const content = await fs.readFile(path, { encoding: 'utf8' });
        const svg: Svg = await svgson.parse(content, { camelcase: true });


        if (mode === 'auto') {
            if (this.existWidthAndHeight(svg))
                return this.getWidthHeight(svg);

            return this.getViewport(svg);
        }

        if (mode === 'widthAndHeight')
            return this.getWidthHeight(svg);

        return this.getViewport(svg);
    }

    existWidthAndHeight(svg: Svg) {
        return svg.attributes.width && svg.attributes.height;

    }

    getWidthHeight(svg: Svg): Dimension {
        const { width, height } = svg.attributes;

        const getSize = (size: string) => {
            const length = parseFloat(width);

            if (size.endsWith('%'))
                return length / 100;

            return length;
        };

        return this.normalizeDimension({ width: getSize(width), height: getSize(height) });
    }


    getViewport(svg: Svg): Dimension {
        const [ xmin, ymin, xmax, ymax ] = svg.attributes.viewBox.split(' ').map(v => parseFloat(v.trim()));

        const width = xmax - xmin;
        const height = ymax - ymin;

        return this.normalizeDimension({ width, height });

    }

    private normalizeDimension({ width, height }: Dimension) {
        return {
            width: Number.isNaN(width) ? undefined : width,
            height: Number.isNaN(height) ? undefined : height
        };
    }
}
