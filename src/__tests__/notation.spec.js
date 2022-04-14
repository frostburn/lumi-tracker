import { describe, it, expect } from "vitest";

import { mosMonzoToSmitonic, mosMonzoToJ, mosMonzoToDiatonic } from "../notation.js";

describe("Smitonic notation", () => {
  it("matches up with generic", () => {
    for (let coordL = -4; coordL < 5; ++coordL) {
      for (let coordS = -4; coordS < 5; ++coordS) {
        const monzo = [coordL, coordS];
        const smitonic = mosMonzoToSmitonic(monzo);
        const j = mosMonzoToJ("4L 3s", monzo, false);
        expect(j).toEqual(smitonic);
      }
    }
  });
});

describe("Diatonic notation", () => {
  it("has 5 unique accidentals", () => {
    const natural = mosMonzoToDiatonic([0, 0])[1];
    const sharp = mosMonzoToDiatonic([1, -1])[1];
    const flat = mosMonzoToDiatonic([-1, 1])[1];
    const doubleSharp = mosMonzoToDiatonic([2, -2]).slice(1, 3);
    const doubleFlat = mosMonzoToDiatonic([-2, 2]).slice(1, 3);
    const accidentals = new Set([natural, sharp, flat, doubleSharp, doubleFlat]);
    expect(accidentals.size).toEqual(5);
  });
  it("saturates at triple sharps", () => {
    const triple = mosMonzoToDiatonic([3, -3]).slice(1, 3);
    const quadruple = mosMonzoToDiatonic([4, -4]).slice(1, 3);
    expect(triple).toEqual(quadruple);
  });
  it("saturates at triple flats", () => {
    const triple = mosMonzoToDiatonic([-3, 3]).slice(1, 3);
    const quadruple = mosMonzoToDiatonic([-4, 4]).slice(1, 3);
    expect(triple).toEqual(quadruple);
  });
});
