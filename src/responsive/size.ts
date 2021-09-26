export default function (neededSize: string, originalSize: number) {

    if (neededSize === undefined || neededSize === null) {
        return null;
    }

    if (typeof neededSize === 'string' && neededSize.indexOf('%') > -1) {
        const percentage = parseFloat(neededSize);

        if (Number.isNaN(percentage))
            throw new Error(`Wrong percentage size "${neededSize}"`);

        return Math.round(originalSize * percentage * 0.01);
    }

    const size = parseInt(neededSize);
    if (Number.isNaN(size)) {
        throw new Error(`Wrong size "${size}"`);
    }
    return size;
}
