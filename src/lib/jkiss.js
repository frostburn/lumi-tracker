// Public domain code for 31-bit KISS generator.
// Depends on JS bitwise operators producing signed 32 bit integers.

const INT32_MASK_FULL = 4294967295;
const INT32_MASK_POSITIVE = 2147483647;
const INVERSE_NORM = 1 / INT32_MASK_POSITIVE;

export default class JKISS31 {
  constructor(seed) {
    this.seed(seed);
  }

  reset() {
    this.x = 123456789;
    this.y = 234567891;
    this.z = 345678912;
    this.w = 456789123;
    this.c = 0;
  }

  static get MAX_VALUE() {
    return INT32_MASK_POSITIVE;
  }

  static unserialize(packet) {
    const params = JSON.parse(packet);
    const j = new this();

    j.x = params.x;
    j.y = params.y;
    j.z = params.z;
    j.w = params.w;
    j.c = params.c;

    return j;
  }

  serialize() {
    return JSON.stringify(this);
  }

  scramble() {
    this.x = (Math.random() * INT32_MASK_FULL) & INT32_MASK_FULL;
    this.y = (Math.random() * INT32_MASK_FULL) & INT32_MASK_FULL;
    this.z = (Math.random() * INT32_MASK_FULL) & INT32_MASK_FULL;
    this.w = (Math.random() * INT32_MASK_FULL) & INT32_MASK_FULL;
    this.c = (Math.random() < 0.5) & 1;
  }

  seed(s) {
    this.reset();
    if (s === undefined) {
      return;
    }
    s = (s * 1287649287 + 777777) & INT32_MASK_FULL;
    this.x ^= s;
    s = (s*s) & INT32_MASK_FULL;
    this.y ^= s;
    s = (s*s) & INT32_MASK_FULL;
    this.z ^= s;
  }

  step() {
    this.y ^= (this.y << 5);
    this.y ^= (this.y >> 7);
    this.y ^= (this.y << 22);
    const t = (this.z + this.w + this.c) & INT32_MASK_FULL;
    this.z = this.w;
    this.c = (t < 0) & 1;
    this.w = t & 2147483647;
    this.x = (this.x + 1411392427) & INT32_MASK_FULL;

    return (this.x + this.y + this.w) & INT32_MASK_POSITIVE;
  }

  step01() {
    return this.step() * INVERSE_NORM;
  }

  /* Not a true normal distribution, but somewhat close. */
  normal() {
    return (this.step() - this.step() + this.step() - this.step() + this.step() - this.step()) * INVERSE_NORM;
  }
}
