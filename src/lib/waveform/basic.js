const TWO_PI = 2*Math.PI;

export function sine(phase) {
  return Math.sin(TWO_PI * phase);
}

export function cosine(phase) {
  return Math.cos(TWO_PI * phase);
}

export function semisine(phase) {
  return Math.abs(Math.cos(Math.PI * phase)) * 2 - 1;
}

export function sawtooth(phase) {
  return 2*(phase - Math.floor(phase + 0.5));
}

export function triangle(phase) {
  return 4*(0.25 - Math.abs(phase - Math.floor(phase + 0.25) - 0.25));
}

export function square(phase) {
  return (phase - Math.floor(phase) < 0.5)*2 - 1;
}
