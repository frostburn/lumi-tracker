import { describe, it, expect } from "vitest";

import { mosMonzoToSmitonic, mosMonzoToJ } from "../notation.js";

describe("Smitonic Notation", () => {
  it("matches up with generic", () => {
    for (let coordL = -4; coordL < 5; ++coordL) {
      for (let coordS = -4; coordS < 5; ++coordS) {
        const monzo = [coordL, coordS];
        const smitonic = mosMonzoToSmitonic(monzo);
        const j = mosMonzoToJ("4L 3s", monzo);
        expect(j).toEqual(smitonic);
      }
    }
  });
});
