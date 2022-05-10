import { gcd, mod } from "./util.js";

const BRIGTH_GENERATORS = {
  "2,5": [1, 2],
  "5,2": [3, 1],
  "2,9": [1, 4],
  "3,8": [2, 5],
  "4,7": [3, 5],
  "7,4": [2, 1],
  "8,3": [3, 1],
  "9,2": [5, 1],
  "3,5": [2, 3],
  "5,3": [2, 1],
  "2,7": [1, 3],
  "7,2": [4, 1],
  "3,7": [1, 2],
  "7,3": [5, 2],
  "5,7": [3, 4],
  "7,5": [3, 2],
};

function brightMosGeneratorMonzo(l, s) {
  // Shortcuts
  if (s === 1) {
    return [1, 0];
  }
  if (l === 1) {
    return [1, s - 1];
  }
  if (l === s - 1) {
    return [1, 1];
  }
  if (l === s + 1) {
    return [l - 1, s - 1];
  }

  // Pre-calculated
  const key = `${l},${s}`;
  if (key in BRIGTH_GENERATORS) {
    return BRIGTH_GENERATORS[key];
  }

  // Degenerate cases
  if (l === 0) {
    return [0, 1];
  }
  if (s === 0) {
    return [1, 0];
  }

  throw new Error(`General algorithm not implemented for ${key}`);
}

export function mosPatterns(countL, countS) {
  let l = countL;
  let s = countS;
  const numPeriods = gcd(l, s);
  l /= numPeriods;
  s /= numPeriods;
  const monzo = brightMosGeneratorMonzo(l, s);
  const g = 2*monzo[0] + monzo[1];
  const p = 2*l + s;

  const result = [];
  for (let down = 0; down < l+s; ++down) {
    const scale = [];
    for (let i = 0; i < l+s; ++i) {
      scale.push(mod((i-down)*g, p));
    }
    scale.sort((a, b) => a-b);
    scale.push(p);
    let pattern = "";
    for (let i = 0; i < l+s; ++i) {
      if ((scale[i+1] - scale[i]) === 2) {
        pattern += "L";
      } else {
        pattern += "s";
      }
    }
    result.push(pattern.repeat(numPeriods));
  }
  return result;
}
