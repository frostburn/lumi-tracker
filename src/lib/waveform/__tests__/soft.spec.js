import { describe, it, expect } from "vitest";

import { softSemisine, softSawtooth, softTriangle, softSquare } from "../soft.js";

const PHASES = [-1.1, 0, 0.25, 0.5, 1, 2.9];

describe("Soft semisine", () => {
  it("is periodic", () => {
    PHASES.forEach(phase => {
      expect(softSemisine(phase, 0.5)).toBeCloseTo(softSemisine(phase+1, 0.5));
    });
  });
  it("is continuous around sharpness=0", () => {
    PHASES.forEach(phase => {
      expect(softSemisine(phase, 0.01)).toBeCloseTo(softSemisine(phase, 0));
    });
  });
  it("is continuous around sharpness=1", () => {
    PHASES.forEach(phase => {
      expect(softSemisine(phase, 0.99)).toBeCloseTo(softSemisine(phase, 1));
    });
  });
});

describe("Soft sawtooth", () => {
  it("is periodic", () => {
    PHASES.forEach(phase => {
      expect(softSawtooth(phase, 0.5)).toBeCloseTo(softSawtooth(phase+1, 0.5));
    });
  });
  it("is continuous around sharpness=0", () => {
    PHASES.forEach(phase => {
      expect(softSawtooth(phase, 0.01)).toBeCloseTo(softSawtooth(phase, 0));
    });
  });
  it("is continuous around sharpness=1", () => {
    [-1.1, 0, 0.501, 1, 2.9].forEach(phase => {
      expect(softSawtooth(phase, 0.9999)).toBeCloseTo(softSawtooth(phase, 1));
    });
  });
});

describe("Soft triangle", () => {
  it("is periodic", () => {
    PHASES.forEach(phase => {
      expect(softTriangle(phase, 0.5)).toBeCloseTo(softTriangle(phase+1, 0.5));
    });
  });
  it("is continuous around sharpness=0", () => {
    PHASES.forEach(phase => {
      expect(softTriangle(phase, 0.01)).toBeCloseTo(softTriangle(phase, 0));
    });
  });
  it("is continuous around sharpness=1", () => {
    PHASES.forEach(phase => {
      expect(softTriangle(phase, 0.9999)).toBeCloseTo(softTriangle(phase, 1));
    });
  });
});

describe("Soft square", () => {
  it("is periodic", () => {
    PHASES.forEach(phase => {
      expect(softSquare(phase, 0.5)).toBeCloseTo(softSquare(phase+1, 0.5));
    });
  });
  it("is continuous around sharpness=0", () => {
    PHASES.forEach(phase => {
      expect(softSquare(phase, 0.01)).toBeCloseTo(softSquare(phase, 0));
    });
  });
  it("is continuous around sharpness=1", () => {
    [-1.1, 0.01, 0.501, 1.01, 2.9].forEach(phase => {
      expect(softSquare(phase, 0.999)).toBeCloseTo(softSquare(phase, 1));
    });
  });
});
