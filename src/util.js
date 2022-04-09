export function mod(n, m) {
  return ((n % m) + m) % m;
}

export const NOTE_OFF = Symbol();

// Make C4 the reference pitch with A4=440Hz
export const REFERENCE_OCTAVE = 4;
export const REFERENCE_FREQUENCY = 220 * 2**0.25;

export function mosMonzoToEtStep(monzo, l, s) {
    const [coordL, coordS] = monzo;
    return coordL*l + coordS*s;
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

// TODO: Generalize
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
