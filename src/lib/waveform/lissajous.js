const EPSILON = 1e-6;
const TWO_PI = 2 * Math.PI;

function clip(x, low, high) {
    if (x < low) {
        return low;
    }
    if (x > high) {
        return high;
    }
    return x;
}

export function lissajous21(phase, sharpness=0, bias=0) {
    const s = clip(sharpness, -1, 1);
    const b = 0.5 * Math.PI * clip(bias, EPSILON - 1, 1 - EPSILON);
    return Math.atan2(
        (1 + s) * Math.sin(TWO_PI * phase),
        (1 - s) * Math.cos(4 * Math.PI * phase + b)
    ) * 4 / (3 * Math.PI);
}


export function lissajous13(phase, sharpness=0, bias=0) {
    const x = phase - Math.floor(phase + 0.5);
    const s = clip(sharpness, -1, 1);
    const b = Math.PI / 6 * clip(bias, EPSILON - 1, 1 - EPSILON);
    return Math.atan2(
        (1 + s) * Math.sin(3 * Math.PI * x),
        (1 - s) * Math.cos(Math.PI * x + b)
    ) * 2 / Math.PI + 2 * x;
}

export function lissajous23(phase, sharpness=0, bias=0) {
    const x = phase - Math.floor(phase + 0.5);
    const s = clip(sharpness, -1, 1);
    const b = Math.PI / 6 * clip(bias, EPSILON - 1, 1 - EPSILON);
    let l = Math.atan2(
        (1 + s) * Math.sin(6 * Math.PI * x),
        (1 - s) * Math.cos(4 * Math.PI * x + b)
    );
    if (x > 0 && l < 0) {
        l += TWO_PI;
    }
    if (x < 0 && l > 0) {
        l -= TWO_PI;
    }
    return l * 4 / (5 * Math.PI);
}

export function lissajous25(phase, sharpness=0, bias=0) {
    const x = phase - Math.floor(phase + 0.5);
    const s = clip(sharpness, -1, 1);
    const b = Math.PI * 0.1 * clip(bias, EPSILON - 1, 1 - EPSILON);
    let l = Math.atan2(
        (-1 - s) * Math.sin(10 * Math.PI * x),
        (1 - s) * Math.cos(4 * Math.PI * x + b)
    );
    if (0.15 < x && x < 0.35 && l < 0) {
        l += TWO_PI;
    }
    if (-0.35 < x && x < -0.15 && l > 0) {
        l -= TWO_PI;
    }

    return l * 4 / (5 * Math.PI);
}

export function lissajous34(phase, sharpness=0, bias=0) {
    const x = phase - Math.floor(phase + 0.5);
    const s = clip(sharpness, -1, 1);
    const b = Math.PI / 6 * clip(bias, EPSILON - 1, 1 - EPSILON);
    let l = Math.atan2(
        (1 - s) * Math.sin(6 * Math.PI * x),
        (1 + s) * Math.cos(8 * Math.PI * x + b)
    );
    if (0.1 < x && x < 0.4 && l <= 0) {
        l += TWO_PI;
    }
    if (-0.4 < x && x < -0.1 && l >= 0) {
        l -= TWO_PI;
    }
    return l * 4 / (7 * Math.PI);
}

export function lissajous35(phase, sharpness=0, bias=0) {
    const x = phase - Math.floor(phase + 0.5);
    const s = clip(sharpness, -1, 1);
    const b = Math.PI * 0.1 * clip(bias, EPSILON - 1, 1 - EPSILON);
    let l = Math.atan2(
        (1 + s) * Math.sin(5 * Math.PI * x),
        (1 - s) * Math.cos(3 * Math.PI * x + b)
    );
    if (x > 0 && l < 0) {
        l += TWO_PI;
    }
    if (x < 0 && l > 0) {
        l -= TWO_PI;
    }
    return l / Math.PI - x
}
