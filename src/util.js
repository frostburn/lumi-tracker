export function mod(n, m) {
    return ((n % m) + m) % m;
}

export function gcd(a, b) {
    if (b) {
        return gcd(b, a % b);
    } else {
        return Math.abs(a);
    }
}

export function unicodeSplit(str) {
    return [...str];
}

export function unicodeLength(str) {
    return [...str].length;
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

export function toSignedString(number, saturated=true) {
    if (saturated) {
        if (number > 35) {
            return "🠵";
        }
        if (number < -26) {
            return "🠷";
        }
    }
    if (number >= 0) {
        return number.toString(36).toUpperCase();
    }
    return (9-number).toString(36).toLowerCase();
}

function swing(phase, midpoint) {
  const floor = Math.floor(phase);
  phase -= floor;
  if (phase < midpoint) {
    return 0.5 * phase / midpoint + floor;
  }
  return 0.5 + 0.5 * (phase - midpoint) / (1 - midpoint) + floor;
}
