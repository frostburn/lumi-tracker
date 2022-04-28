import {sine, cosine, semisine, sawtooth, triangle, square} from "./basic.js";

const EPSILON = 1e-6;

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
    sharpness = 1 - EPSILON;
    return sawtooth(phase);
  }
  return Math.atan(
    sharpness * Math.sin(2*Math.PI * phase) / (1 + sharpness * Math.cos(2*Math.PI * phase))
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

export function softSinh(phase, sharpness) {
  if (sharpness < EPSILON) {
    return sine(phase);
  }
  return Math.sinh(sine(phase) * sharpness) / Math.sinh(sharpness);
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
