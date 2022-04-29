import {sine, cosine, semisine, sawtooth, triangle, square} from "./basic.js";

const EPSILON = 1e-6;
const TWO_PER_PI = 2 / Math.PI;

export function softSemisine(phase, sharpness) {
  if (sharpness < EPSILON) {
    return cosine(phase);
  }
  if (sharpness >= 1) {
    return semisine(phase);
  }
  return (
    Math.hypot(
      (1 + sharpness) * Math.cos(Math.PI * phase),
      (1 - sharpness) * Math.sin(Math.PI * phase)
    ) - 1
  ) / sharpness;
}

export function softSawtooth(phase, sharpness) {
  if (sharpness < EPSILON) {
    return sine(phase);
  }
  if (sharpness > 1 - EPSILON) {
    return sawtooth(phase);
  }
  return Math.atan(
    sharpness * sine(phase) / (1 + sharpness * cosine(phase))
  ) / Math.asin(sharpness);
}

export function softTriangle(phase, sharpness) {
  if (sharpness < EPSILON) {
    return sine(phase);
  }
  if (sharpness >= 1) {
    return triangle(phase);
  }
  return Math.asin(sharpness*sine(phase)) / Math.asin(sharpness);
}

export function softSquare(phase, sharpness) {
  if (sharpness < EPSILON) {
    return sine(phase);
  }
  if (sharpness > 1 - EPSILON) {
    return square(phase);
  }
  sharpness = sharpness / (1 - sharpness);
  return Math.atan(sine(phase) * sharpness) / Math.atan(sharpness);
}

export function softSinh(phase, sharpness, separation) {
  if (sharpness < EPSILON) {
    return cosine(phase);
  }
  return (
    Math.exp(sine(phase + separation) * sharpness) - Math.exp(sine(phase - separation) * sharpness)
  ) / ((Math.exp(sharpness) - Math.exp(-sharpness)) * sine(separation) * (1 + (0.25 - separation) * sharpness));
}

export function softCosh(phase, sharpness) {
  if (sharpness < EPSILON) {
    return -cosine(phase);
  }
  return 2*(Math.cosh(Math.sin(Math.PI*phase) * sharpness) - 1) / (Math.cosh(sharpness) - 1) - 1;
}

export function softTanh(phase, sharpness) {
  if (sharpness < EPSILON) {
    return sine(phase);
  }
  return Math.tanh(sine(phase) * sharpness) / Math.tanh(sharpness);
}

export function softLog(phase, sharpness) {
  if (sharpness < EPSILON) {
    return sine(phase);
  }
  if (sharpness > 1 - EPSILON) {
    // TODO: Find the correct limit if it exists
    return 1;
  }
  const min = Math.log1p(-sharpness)
  return 2*((Math.log1p(sine(phase) * sharpness) - min) / (Math.log1p(sharpness) - min)) - 1;
}

export function softPulse(phase, sharpness, separation) {
  if (sharpness < EPSILON) {
    return cosine(phase);
  }
  if (sharpness > 1 - EPSILON) {
    return sawtooth(phase + separation) - sawtooth(phase - separation);
  }
  const sp = sharpness * sine(phase);
  const ss = sine(separation);
  const cp = sharpness * cosine(phase);
  const cs = cosine(separation);
  const a = sp*cs;
  const b = cp*ss;
  const c = cp*cs;
  const d = sp*ss;
  return (
      Math.atan((a + b) / (1 + c - d)) - Math.atan((a - b) / (1 + c + d))
  ) * (0.5 + sharpness * (TWO_PER_PI - 0.5)) / (sharpness * (ss + (1 - ss) * sharpness));
  // Slightly more readable version:
  // return (
  //   Math.atan(sharpness * sine(phase + separation) / (1 + sharpness * cosine(phase + separation))) -
  //   Math.atan(sharpness * sine(phase - separation) / (1 + sharpness * cosine(phase - separation)))
  // ) * (0.5 / sharpness + 2/Math.PI - 0.5) / (sine(separation) + (1 - sine(separation)) * sharpness);
}

export function softTent(phase, sharpness, separation) {
  if (sharpness < EPSILON) {
    return -sine(phase);
  }
  if (sharpness >= 1) {
    return 0.5 * (semisine(phase + separation) - semisine(phase - separation)) / sine(separation);
  }
  const s1p = 1 + sharpness;
  const s1m = 1 - sharpness;
  const pps = Math.PI * (phase + separation);
  const pms = Math.PI * (phase - separation);
  return (
    Math.hypot(s1p * Math.cos(pps), s1m * Math.sin(pps)) -
    Math.hypot(s1p * Math.cos(pms), s1m * Math.sin(pms))
  ) / (2 * sharpness * sine(separation));
}
