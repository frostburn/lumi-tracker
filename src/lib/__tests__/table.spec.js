import { describe, it, expect } from "vitest";

import { getTableValue, parseTable } from "../table.js";

describe("Table evaluator", () => {
  it("supports constant interpolation", () => {
    expect(getTableValue(1.7, {
      linear: false,
      loopStart: 3,
      data: [1, 2, 3, 4],
    })).toEqual(2);
  });
  it("supports linear interpolation", () => {
    expect(getTableValue(1.7, {
      linear: true,
      loopStart: 1,
      data: [-1, 2, 3, 5],
    })).toEqual(2.7);
  });
  it("supports loops", () => {
    expect(getTableValue(4.7, {
      linear: true,
      loopStart: 1,
      data: [-1, 2, 3, 5],
    })).toEqual(2.7);
  });
});

describe("Table parser", () => {
  it("defaults to percents", () => {
    expect(parseTable("100 90 50 10 0")).toEqual({
      linear: false,
      loopStart: 4,
      data: [1.0, 0.9, 0.5, 0.1, 0],
    });
  });
  it("supports loop definition", () => {
    expect(parseTable("10 9|5 4 3 4 /10l")).toEqual({
      linear: true,
      loopStart: 2,
      data: [1.0, 0.9, 0.5, 0.4, 0.3, 0.4],
    });
  })
});
