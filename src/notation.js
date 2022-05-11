import { mod, gcd, REFERENCE_OCTAVE, toSignedString } from "./util.js";

export const MOS_PATTERNS = {
    // Key: basisOfNotation,  // reason for the choice
    '1L 1s': 'Ls',  // tonic
    '1L 2s': 'sLs',  // symmetric = s
    '2L 1s': 'LsL',  // s
    '1L 3s': 'sLss',  // subset of symmetric 4L 1s
    '2L 2s': 'LsLs',  // tonic
    '3L 1s': 'LLsL',  // superset of symmetric 1L 2s
    '1L 4s': 'ssLss',  // s
    '2L 3s': 'sLsLs',  // s
    '3L 2s': 'LsLsL',  // s
    '4L 1s': 'LLsLL',  // s
    '1L 5s': 'ssLsss',  // subset of symmetric 6L 1s
    '2L 4s': 'sLssLs',  // s
    '3L 3s': 'LsLsLs',  // tonic
    '4L 2s': 'LsLLsL',  // s
    '5L 1s': 'LLLsLL',  // superset of symmetric 1L 4s
    '1L 6s': 'sssLsss',  // s
    '2L 5s': 'sLsssLs',  // s
    '3L 4s': 'sLsLsLs',  // s
    '4L 3s': 'LsLsLsL',  // s
    '5L 2s': 'LLsLLLs',  // tradition, dorian 'LsLLLsL' would be symmetric
    '6L 1s': 'LLLsLLL',  // s
    '1L 7s': 'sssLssss',  // subset of symmetric 8L 1s
    '2L 6s': 'LsssLsss',  // anti mid-brigth
    '3L 5s': 'sLssLsLs',  // xenwiki article, also anti mid-bright
    '4L 4s': 'LsLsLsLs',  // tonic
    '5L 3s': 'LsLLsLsL',  // xenwiki article, also mid-bright
    '6L 2s': 'LLsLLLsL',  // mid-bright
    '7L 1s': 'LLLLsLLL',  // superset of symmetric 1L 6s
    '1L 8s': 'ssssLssss',  // s
    '2L 7s': 'ssLsssLss',  // s
    '3L 6s': 'sLssLssLs',  // s
    '4L 5s': 'sLsLsLsLs',  // s, xenwiki article wants the brightest 'LsLsLsLss'
    '5L 4s': 'LsLsLsLsL',  // s
    '6L 3s': 'LsLLsLLsL',  // s
    '7L 2s': 'LLsLLLsLL',  // s
    '8L 1s': 'LLLLsLLLL',  // s
    '1L 9s': 'ssssLsssss',  // subset of symmetric 10L 1s
    '2L 8s': 'ssLssssLss',  // s
    '3L 7s': 'sLsssLssLs',  // anti mid-bright
    '4L 6s': 'sLsLssLsLs',  // s
    '5L 5s': 'LsLsLsLsLs',  // tonic
    '6L 4s': 'LsLsLLsLsL',  // s
    '7L 3s': 'LsLLLsLLsL',  // mid-bright
    '8L 2s': 'LLsLLLLsLL',  // s
    '9L 1s': 'LLLLLsLLLL',  // superset of symmetric 1L 8s
    '1L 10s': 'sssssLsssss',  // s
    '2L 9s': 'ssLsssssLss',  // s
    '3L 8s': 'sLsssLsssLs',  // s
    '4L 7s': 'sLssLsLssLs',  // s, xenwiki article wants 'LssLsLssLss'
    '5L 6s': 'sLsLsLsLsLs',  // s
    '6L 5s': 'LsLsLsLsLsL',  // s
    '7L 4s': 'LsLLsLsLLsL',  // s
    '8L 3s': 'LsLLLsLLLsL',  // s
    '9L 2s': 'LLsLLLLLsLL',  // s
    '10L 1s': 'LLLLLsLLLLL',  // s
    '1L 11s': 'sssssLssssss',  // subset of symmetric 12L 1s
    '2L 10s': 'sssLsssssLss',  // anti mid-bright
    '3L 9s': 'ssLsssLsssLs',  // anti mid-bright
    '4L 8s': 'sLssLssLssLs',  // s
    '5L 7s': 'sLsLssLsLsLs',  // anti mid-bright
    '6L 6s': 'LsLsLsLsLsLs',  // tonic
    '7L 5s': 'LsLsLLsLsLsL',  // mid-bright
    '8L 4s': 'LsLLsLLsLLsL',  // s
    '9L 3s': 'LLsLLLsLLLsL',  // mid-bright
    '10L 2s': 'LLLsLLLLLsLL ',  // mid-bright
    '11L 1s': 'LLLLLLsLLLLL',  // superset of symmetric 1L 10s
};

export const MOS_BY_EDO = new Map();

const HARDNESS_RATIOS = [
    ["equalized", 1, 1],
    ["supersoft", 4, 3],
    ["soft", 3, 2],
    ["semisoft", 5, 3],
    ["basic", 2, 1],
    ["semihard", 5, 2],
    ["hard", 3, 1],
    ["superhard", 4, 1],
    ["paucitonic", 1, 0],
];

const HARDNESS_RANGES = [
    ["ultrasoft", 6, 8],
    ["parasoft", 8, 9],
    ["quasisoft", 9, 10],
    ["minisoft", 10, 12],
    ["minihard", 12, 15],
    ["quasihard", 15, 18],
    ["parahard", 18, 24],
    ["ultrahard", 24, Infinity],
];

export function getHardness(l, s) {
    let prefix = "";
    if (l < 0) {
        prefix = "quasi-" + prefix;
        l = -l;
    }
    if (s < 0) {
        prefix = "pseudo-" + prefix;
        s = -s;
    }
    if (s > l) {
        prefix = "anti-" + prefix;
        [l, s] = [s, l];
    }
    for (let i = 0; i < HARDNESS_RATIOS.length; ++i) {
        const [name, large, small] = HARDNESS_RATIOS[i];
        if (l*small == large*s) {
            return prefix + name;
        }
    }
    for (let i = 0; i < HARDNESS_RANGES.length; ++i) {
        const [name, low, high] = HARDNESS_RANGES[i];
        if (low*s < 6*l && 6*l < high*s) {
            return prefix + name;
        }
    }
    throw "Unable to determine hardness";
}

// Populate MOS_BY_EDO
const hardnesses = [
    [1, 0],
    [1, 1],
    [2, 1],
    [3, 1], [3, 2],
    [4, 1], [4, 3],
    [5, 1], [5, 2], [5, 3], [5, 4],
];

for (let size = 5; size <= 12; ++size) {
    for (let countL = 1; countL < size; countL++) {
        const countS = size - countL;
        hardnesses.forEach(([l, s]) => {
            const edo = countL*l + countS*s;
            const info = [countL, countS, l, s];
            const infos = MOS_BY_EDO.get(edo) || [];
            infos.push(info);
            MOS_BY_EDO.set(edo, infos);
        });
    }
}

// Extra diatonics
for (let l = 6; l < 12; ++l) {
    for (let s = 1; s < l; ++s) {
        if (gcd(l, s) === 1) {
            const edo = 5*l + 2*s;
            if (edo <= 59) {
                MOS_BY_EDO.get(edo).unshift([5, 2, l, s]);
            }
        }
    }
}

const DEGREES_BY_MOS = {};

for (const mos in MOS_PATTERNS) {
    const pattern = MOS_PATTERNS[mos];
    const monzo = [0, 0];
    const degrees = [];
    pattern.split("").forEach(s => {
        degrees.push([...monzo]);
        if (s === "L") {
            monzo[0]++;
        } else {
            monzo[1]++;
        }
    });
    DEGREES_BY_MOS[mos] = degrees;
}

function mosPatterns(countL, countS) {
    const key = `${countL}L ${countS}s`
    let pattern = MOS_PATTERNS[key];
    const m = gcd(countL, countS);
    const result = [];
    for (let i = 0; i < countL + countS; i += m) {
        result.push(pattern);
        pattern = pattern.slice(-1) + pattern.slice(0, -1);
    }
    return result;
}

export function mosMonzoToJ(mos, monzo, saturated=true) {
    const degrees = DEGREES_BY_MOS[mos];
    const countL = parseInt(mos.split(" ")[0].slice(0, -1));
    const countS = parseInt(mos.split(" ")[1].slice(0, -1));
    let [coordL, coordS] = monzo;
    let octaves = REFERENCE_OCTAVE;
    while (coordL + coordS >= countL + countS) {
        coordL -= countL;
        coordS -= countS;
        octaves++;
    }
    while (coordL + coordS < 0) {
        coordL += countL;
        coordS += countS;
        octaves--;
    }
    const degree = degrees[coordL + coordS];
    let amps = coordL - degree[0];
    let accidental = '';
    if (saturated) {
        if (amps >= 3) {
            accidental = "🠵";
            amps = 0;
        }
        if (amps <= -3) {
            accidental = "🠷";
            amps = 0;
        }
    }
    while (amps >= 2) {
        accidental += '§';  // Non-standard
        amps -= 2;
    }
    while (amps > 0) {
        accidental = '&' + accidental;
        amps -= 1;
    }
    while (amps <= -2) {
        accidental += '©';  // Non-standard
        amps += 2;
    }
    while (amps < 0) {
        accidental = '@' + accidental;
        amps += 1;
    }
    if (accidental === "") {
        accidental = "·";  // Non-standard
    }

    const letter = String.fromCharCode('J'.charCodeAt(0) + coordL + coordS);

    let octaveStr;
    if (saturated) {
        octaveStr = toSignedString(octaves);
    } else {
        octaveStr = octaves.toString(16);
    }

    return letter + accidental + octaveStr;
}

const FIFTHS_CHAIN = "FCGDAEB";
const FIFTHS_CHAIN_INDEX_C = FIFTHS_CHAIN.indexOf("C");
const SHARP_FIFTHS = 7;
const SHARP_OCTAVES = -4;

const OCTAVE_CORRECTIONS = [-1, 0, 0, 1, 1, 2, 2];

export function mosMonzoToDiatonic(monzo, saturated=true) {
    const [coordL, coordS] = monzo;
    const fifths = 2*coordL - 5*coordS;
    let octaves = 3*coordS - coordL + REFERENCE_OCTAVE;

    let index = fifths + FIFTHS_CHAIN_INDEX_C;

    octaves += OCTAVE_CORRECTIONS[mod(index, FIFTHS_CHAIN.length)];

    const letter = FIFTHS_CHAIN[mod(index, FIFTHS_CHAIN.length)];
    let accidental = "";

    if (saturated) {
        if (index >= 3*FIFTHS_CHAIN.length) {
            accidental = "🠵";
            index = 0;
        }
        if (index <= -2*FIFTHS_CHAIN.length) {
            accidental = "🠷";
            index = 0;
        }
    }

    while (index < -FIFTHS_CHAIN.length) {
        accidental += "𝄫";
        index += 2*FIFTHS_CHAIN.length;
        octaves += 2*SHARP_OCTAVES;
    }
    while (index < 0) {
        accidental += "♭";
        index += FIFTHS_CHAIN.length;
        octaves += SHARP_OCTAVES;
    }
    while (index >= 2*FIFTHS_CHAIN.length) {
        accidental += "𝄪";
        index -= 2*FIFTHS_CHAIN.length;
        octaves -= 2*SHARP_OCTAVES;
    }
    while (index >= FIFTHS_CHAIN.length) {
        accidental += "♯";
        index -= FIFTHS_CHAIN.length;
        octaves -= SHARP_OCTAVES;
    }
    if (accidental === "") {
        accidental = "♮";
    }

    let octaveStr;
    if (saturated) {
        octaveStr = toSignedString(octaves);
    } else {
        octaveStr = octaves.toString(16);
    }

    return letter + accidental + octaveStr;
}

const SMI_CHAIN = "KMOJLNP"
const SMI_CHAIN_INDEX_J = SMI_CHAIN.indexOf("J");
const SMI_AMP_GENS = 7;
const SMI_AMP_OCTAVES = -2;
const SMI_CORRECTIONS = [-1, -1, -1, 0, 0, 0, 0];

export function mosMonzoToSmitonic(monzo) {
    const [coordL, coordS] = monzo;
    const smithirds = 4*coordS - 3*coordL;
    let octaves = coordL - coordS + REFERENCE_OCTAVE;

    let index = smithirds + SMI_CHAIN_INDEX_J;

    octaves += SMI_CORRECTIONS[mod(index, SMI_CHAIN.length)];

    const letter = SMI_CHAIN[mod(index, SMI_CHAIN.length)];
    let accidental = "";

    while (index < -SMI_CHAIN.length) {
        accidental += "§";  // Non-standard
        index += 2*SMI_CHAIN.length;
        octaves += 2*SMI_AMP_OCTAVES;
    }
    while (index < 0) {
        accidental = "&" + accidental;
        index += SMI_CHAIN.length;
        octaves += SMI_AMP_OCTAVES;
    }
    while (index >= 2*SMI_CHAIN.length) {
        accidental += "©";  // Non-standard
        index -= 2*SMI_CHAIN.length;
        octaves -= 2*SMI_AMP_OCTAVES;
    }
    while (index >= SMI_CHAIN.length) {
        accidental = "@" + accidental;
        index -= SMI_CHAIN.length;
        octaves -= SMI_AMP_OCTAVES;
    }
    if (accidental === "") {
        accidental = "·";  // Non-standard
    }
    return letter + accidental + octaves.toString(16);
}
