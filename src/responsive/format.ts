import path from 'path';


export default function (filePath: string): 'jpeg' | 'png' | 'webp' | 'unsupported' {
    const extname = path.extname(filePath);

    switch (extname) {
        case '.jpeg':
        case '.jpg':
        case '.jpe':
            return 'jpeg';
        case '.png':
            return 'png';
        case '.webp':
            return 'webp';
        default:
            return 'unsupported';
    }
}
