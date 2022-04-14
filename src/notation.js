import { mod, gcd, REFERENCE_OCTAVE, toSignedString } from "./util.js";

const MOS_PATTERNS = {
    '1L 4s': 'ssLss',
    '2L 3s': 'sLsLs',
    '3L 2s': 'LsLsL',
    '4L 1s': 'LLsLL',
    '1L 5s': 'Lsssss',
    '2L 4s': 'sLssLs',
    '3L 3s': 'LsLsLs',
    '4L 2s': 'LsLLsL',
    '5L 1s': 'LLLLLs',
    '1L 6s': 'sssLsss',
    '2L 5s': 'sLsssLs',
    '3L 4s': 'sLsLsLs',
    '4L 3s': 'LsLsLsL',
    '5L 2s': 'LsLLLsL',
    '6L 1s': 'LLLsLLL',
    '1L 7s': 'Lsssssss',
    '2L 6s': 'LsssLsss',
    '3L 5s': 'LsLssLss',
    '4L 4s': 'LsLsLsLs',
    '5L 3s': 'LLsLLsLs',
    '6L 2s': 'LLLsLLLs',
    '7L 1s': 'LLLLLLLs',
    '1L 8s': 'ssssLssss',
    '2L 7s': 'ssLsssLss',
    '3L 6s': 'sLssLssLs',
    '4L 5s': 'sLsLsLsLs',
    '5L 4s': 'LsLsLsLsL',
    '6L 3s': 'LsLLsLLsL',
    '7L 2s': 'LLsLLLsLL',
    '8L 1s': 'LLLsLLL',
    '1L 9s': 'Lsssssssss',
    '2L 8s': 'ssLssssLss',
    '3L 7s': 'LssLssLsss',
    '4L 6s': 'sLsLssLsLs',
    '5L 5s': 'LsLsLsLsLs',
    '6L 4s': 'LsLsLLsLsL',
    '7L 3s': 'LLLsLLsLLs',
    '8L 2s': 'LLsLLLLsLL',
    '9L 1s': 'LLLLLLLLLs',
    '1L 10s': 'sssssLsssss',
    '2L 9s': 'ssLsssssLss',
    '3L 8s': 'sLsssLsssLs',
    '4L 7s': 'sLssLsLssLs',
    '5L 6s': 'sLsLsLsLsLs',
    '6L 5s': 'LsLsLsLsLsL',
    '7L 4s': 'LsLLsLsLLsL',
    '8L 3s': 'LsLLLsLLLsL',
    '9L 2s': 'LLsLLLLLsLL',
    '10L 1s': 'LLLLLsLLLLL'
};

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

export function mosPatterns(countL, countS) {
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
