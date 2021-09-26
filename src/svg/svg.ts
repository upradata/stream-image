import { ObjectOf } from '@upradata/util';


export interface Svg {
    attributes?: {
        width?: string;
        height?: string;
        viewBox?: string;
    };
    children: SvgNode[];
}

export interface SvgNode {
    name: string;
    type: string;
    value: string;
    attributes?: ObjectOf<any>;
    children: SvgNode[];
}
