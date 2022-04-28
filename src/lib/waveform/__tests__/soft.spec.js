import { describe, it, expect } from "vitest";

import { softSemisine, softSawtooth, softTriangle, softSquare, softSinh, softCosh, softTanh, softLog } from "../soft.js";

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
      expect(softSquare(phase, 0.99999)).toBeCloseTo(softSquare(phase, 1));
    });
  });
});

describe("Soft sinh", () => {
  it("is periodic", () => {
    PHASES.forEach(phase => {
      expect(softSinh(phase, 0.5)).toBeCloseTo(softSinh(phase+1, 0.5));
    });
  });
  it("is continuous around sharpness=0", () => {
    PHASES.forEach(phase => {
      expect(softSinh(phase, 0.01)).toBeCloseTo(softSinh(phase, 0));
    });
  });
});

describe("Soft cosh", () => {
  it("is periodic", () => {
    PHASES.forEach(phase => {
      expect(softCosh(phase, 0.5)).toBeCloseTo(softCosh(phase+1, 0.5));
    });
  });
  it("is continuous around sharpness=0", () => {
    PHASES.forEach(phase => {
      expect(softCosh(phase, 0.01)).toBeCloseTo(softCosh(phase, 0));
    });
  });
});

describe("Soft tanh", () => {
  it("is periodic", () => {
    PHASES.forEach(phase => {
      expect(softTanh(phase, 0.5)).toBeCloseTo(softTanh(phase+1, 0.5));
    });
  });
  it("is continuous around sharpness=0", () => {
    PHASES.forEach(phase => {
      expect(softTanh(phase, 0.01)).toBeCloseTo(softTanh(phase, 0));
    });
  });
});

describe("Soft log", () => {
  it("is periodic", () => {
    PHASES.forEach(phase => {
      expect(softLog(phase, 0.5)).toBeCloseTo(softLog(phase+1, 0.5));
    });
  });
  it("is continuous around sharpness=0", () => {
    PHASES.forEach(phase => {
      expect(softLog(phase, 0.001)).toBeCloseTo(softLog(phase, 0));
    });
  });
  // TODO: Assert continuity around sharpness=1 if the limit exists
});
