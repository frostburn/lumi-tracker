import { mod, REFERENCE_OCTAVE } from "./util.js";

const DEGREES_BY_MOS = {
    '1L 4s': [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3]],
    '2L 3s': [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
    '3L 2s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
    '4L 1s': [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1]],
    '1L 5s': [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
    '2L 4s': [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3]],
    '3L 3s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
    '4L 2s': [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]],
    '5L 1s': [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
    '1L 6s': [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [1, 4], [1, 5]],
    '2L 5s': [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4]],
    '3L 4s': [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3]],
    '4L 3s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    '5L 2s': [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [4, 1], [4, 2]],
    '6L 1s': [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1], [5, 1]],
    '1L 7s': [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6]],
    '2L 6s': [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 3], [2, 4], [2, 5]],
    '3L 5s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [2, 3], [3, 3], [3, 4]],
    '4L 4s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3]],
    '5L 3s': [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1], [4, 2], [5, 2]],
    '6L 2s': [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1], [5, 1], [6, 1]],
    '7L 1s': [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]],
    '1L 8s': [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [1, 6], [1, 7]],
    '2L 7s': [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3], [1, 4], [1, 5], [2, 5], [2, 6]],
    '3L 6s': [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3], [2, 4], [2, 5], [3, 5]],
    '4L 5s': [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 4], [4, 4]],
    '5L 4s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    '6L 3s': [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2], [4, 2], [5, 2], [5, 3]],
    '7L 2s': [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1], [5, 1], [5, 2], [6, 2]],
    '8L 1s': [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1], [5, 1]],
    '1L 9s': [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8]],
    '2L 8s': [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6], [2, 7]],
    '3L 7s': [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [3, 5], [3, 6]],
    '4L 6s': [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5]],
    '5L 5s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4]],
    '6L 4s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [4, 2], [4, 3], [5, 3], [5, 4]],
    '7L 3s': [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1], [5, 1], [5, 2], [6, 2], [7, 2]],
    '8L 2s': [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [6, 2], [7, 2]],
    '9L 1s': [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0]],
    '1L 10s': [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9]],
    '2L 9s': [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [2, 7], [2, 8]],
    '3L 8s': [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [2, 5], [2, 6], [2, 7], [3, 7]],
    '4L 7s': [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [3, 6], [4, 6]],
    '5L 6s': [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 4], [4, 4], [4, 5], [5, 5]],
    '6L 5s': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [5, 5]],
    '7L 4s': [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2], [4, 2], [4, 3], [5, 3], [6, 3], [6, 4]],
    '8L 3s': [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [5, 2], [6, 2], [7, 2], [7, 3]],
    '9L 2s': [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [7, 2], [8, 2]],
    '10L 1s': [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1]]
};

export function mosMonzoToJ(mos, monzo) {
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
    while (amps >= 2) {
        accidental += '§';  // Non-standard
        amps -= 2;
    }
    while (amps > 0) {
        accidental += '&';
        amps -= 1;
    }
    while (amps <= -2) {
        accidental += '©';  // Non-standard
        amps += 2;
    }
    while (amps < 0) {
        accidental += '@';
        amps += 1;
    }
    if (accidental === "") {
        accidental = "·";  // Non-standard
    }

    const letter = String.fromCharCode('J'.charCodeAt(0) + coordL + coordS);

    return letter + accidental + octaves.toString(16);
}

const FIFTHS_CHAIN = "FCGDAEB";
const FIFTHS_CHAIN_INDEX_C = FIFTHS_CHAIN.indexOf("C");
const SHARP_FIFTHS = 7;
const SHARP_OCTAVES = -4;

const OCTAVE_CORRECTIONS = [-1, 0, 0, 1, 1, 2, 2];

export function mosMonzoToDiatonic(monzo) {
    const [coordL, coordS] = monzo;
    const fifths = 2*coordL - 5*coordS;
    let octaves = 3*coordS - coordL + REFERENCE_OCTAVE;

    let index = fifths + FIFTHS_CHAIN_INDEX_C;

    octaves += OCTAVE_CORRECTIONS[mod(index, FIFTHS_CHAIN.length)];

    const letter = FIFTHS_CHAIN[mod(index, FIFTHS_CHAIN.length)];
    let accidental = "";

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
    return letter + accidental + octaves.toString(16);
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
        accidental += "&";
        index += SMI_CHAIN.length;
        octaves += SMI_AMP_OCTAVES;
    }
    while (index >= 2*SMI_CHAIN.length) {
        accidental += "©";  // Non-standard
        index -= 2*SMI_CHAIN.length;
        octaves -= 2*SMI_AMP_OCTAVES;
    }
    while (index >= SMI_CHAIN.length) {
        accidental += "@";
        index -= SMI_CHAIN.length;
        octaves -= SMI_AMP_OCTAVES;
    }
    if (accidental === "") {
        accidental = "·";  // Non-standard
    }
    return letter + accidental + octaves.toString(16);
}
