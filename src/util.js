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

const NATS_TO_CENTS = 1200 / Math.LN2;

export function ratioToCents(ratio) {
    return Math.log(ratio) * NATS_TO_CENTS;
}
