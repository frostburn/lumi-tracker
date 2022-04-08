export function mod(n, m) {
  return ((n % m) + m) % m;
}

export const NOTE_OFF = Symbol();

export function mosMonzoToEtStep(monzo, l, s) {
    const [coordL, coordS] = monzo;
    return coordL*l + coordS*s;
}

const LYDIAN = "FCGDAEB";
const LYDIAN_INDEX_C = LYDIAN.indexOf("C");
const REFERENCE_OCTAVE = 3;
const SHARP_FIFTHS = 7;
const SHARP_OCTAVES = -4;

const OCTAVE_CORRECTIONS = [-1, 0, 0, 1, 1, 2, 2];

export function mosMonzoToDiatonic(monzo) {
    const [coordL, coordS] = monzo;
    const fifths = 2*coordL - 5*coordS;
    let octaves = 3*coordS - coordL + REFERENCE_OCTAVE;

    let index = fifths + LYDIAN_INDEX_C;
    octaves += OCTAVE_CORRECTIONS[mod(index, LYDIAN.length)];
    const letter = LYDIAN[mod(index, LYDIAN.length)];
    let accidental = "";
    while (index < -LYDIAN.length) {
        accidental += "𝄫";
        index += 2*LYDIAN.length;
        octaves += 2*SHARP_OCTAVES;
    }
    while (index < 0) {
        accidental += "♭";
        index += LYDIAN.length;
        octaves += SHARP_OCTAVES;
    }
    while (index >= 2*LYDIAN.length) {
        accidental += "𝄪";
        index -= 2*LYDIAN.length;
        octaves -= 2*SHARP_OCTAVES;
    }
    while (index >= LYDIAN.length) {
        accidental += "♯";
        index -= LYDIAN.length;
        octaves -= SHARP_OCTAVES;
    }
    if (accidental === "") {
        accidental = "♮";
    }
    return letter + accidental + octaves.toString(16);
}

// TODO: TAMNAMS J3 at [0, 0]
