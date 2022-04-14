import { describe, it, expect } from "vitest";

import { mod, toSignedString } from "../util.js";

describe("Modulo operator", () => {
  it("works with negative integers", () => {
    expect(mod(-1, 3)).toEqual(2);
  });
});

describe("Signed integer string conversion", () => {
  it("Works up to 35", () => {
    expect(toSignedString(35)).toEqual("Z");
  });
  it("Works down to -26", () => {
    expect(toSignedString(-26)).toEqual("z");
  });
  it("Produces lower case letters for negative integers", () => {
    expect(toSignedString(-1)).toEqual("a");
  });
  it("Saturates at 36", () => {
    expect(toSignedString(36)).toEqual(toSignedString(100));
  });
  it("Saturates at -27", () => {
    expect(toSignedString(-27)).toEqual(toSignedString(-100));
  });
});
