import JKISS31 from "../lib/jkiss.js";
import { getTableValue } from "../lib/table.js";

const EPSILON = 1e-6;

const jkiss31 = new JKISS31();
jkiss31.scramble();

function uniform() {
  return jkiss31.step01() * 2 - 1;
}

function rand() {
  return Math.random() * 2 - 1;
}

function triangular() {
  return jkiss31.step01() - jkiss31.step01();
}

function normal() {
  return jkiss31.normal();
}

class Balanced {
  constructor() {
    this.generator = new JKISS31();
    this.generator.scramble();
    this.last = null;
  }

  step() {
    if (this.last === null) {
      this.last = this.generator.step01() * 2 - 1;
      return this.last;
    }
    const result = -this.last;
    this.last = null;
    return result;
  }
}

class Finite {
  constructor(length, seed) {
    this.length = length;
    this.seed = seed;
    this.generator = new JKISS31(seed);
    this.index = 0;
  }

  reset() {
    this.generator.seed(this.seed);
    this.index = 0;
  }

  step() {
    if (this.index >= this.length) {
      this.reset();
    }
    this.index++;
    return this.generator.step01() * 2 - 1;
  }
}

class Bit {
  constructor(depth) {
    this.depth = depth;
    this.generator = new JKISS31();
    this.generator.scramble();
    this.value = this.generator.step();
    this.remaining = 31;
  }

  set depth(value) {
    this._depth = value;
    this.mask = (1 << value) - 1;
  }

  get depth() {
    return this._depth;
  }

  step() {
    const result = this.value & this.mask;
    this.remaining -= this.depth;
    if (this.remaining < this.depth) {
      this.value = this.generator.step();
      this.remaining = 31;
    } else {
      this.value >>= this.depth;
    }
    return (result / this.mask) * 2 - 1;
  }
}

class Noise extends AudioWorkletProcessor {

  // Static getter to define AudioParam objects in this custom processor.
  static get parameterDescriptors() {
    return [
      { /* Pitch in natural units with 1Hz base frequency */
        name: 'nat',
        defaultValue: 0,
      },
      {
        name: 'jitter',
        defaultValue: 0,
      },
    ];
  }

  constructor() {
    super();
    // Time since last onset
    this.tOnset = 0;
    // Normalized time since last value change
    this.phase = 0;
    // Inverse speed of parameter change
    this.tableDelta = 0.02;

    this.model = rand;
    this.jitterModel = rand;

    this.finite = new Finite();
    this.balanced = new Balanced();
    this.bit = new Bit();
    this.alternating = 1;

    this.jitterFinite = new Finite();
    this.jitterBalanced = new Balanced();
    this.jitterBit = new Bit();
    this.jitterAlternating = 1;

    this.diffs = [];
    this.linear = false;
    this.y0 = this.model();
    this.y1 = this.model();

    this.jitterType = "pitch";
    this.speed = 1;

    this.underSampling = 1;
    this.holdIndex = 0;
    this.holdValue = this.y1;

    this.tables = {
      amplitude: {
        linear: false,
        loopStart: 0,
        data: [1],
      },
      nat: {
        linear: false,
        loopStart: 0,
        data: [0],
      },
      jitter: {
        linear: false,
        loopStart: 0,
        data: [0],
      },
    }

    this.messages = [];
    this.port.onmessage = this.onMessage.bind(this);
  }

  onMessage(msg) {
    const when = msg.data.when;
    if (when === undefined) {
      this.applyMessage(msg);
    } else {
      this.messages.push([when, msg]);
      this.messages.sort((a, b) => a[0] - b[0]);
    }
  }

  triggerMessages(t) {
    while (this.messages.length && this.messages[0][0] <= t) {
      const [when, msg] = this.messages.shift();
      this.applyMessage(msg);
    }
  }

  applyMessage(msg) {
    const data = msg.data;
    if (data.type === "onset") {
      this.tOnset = 0;
      this.finite.reset();
      this.alternating = 1;
      this.jitterFinite.reset();
      this.jitterAlternating = 1;
    } else if (data.type === "cancel") {
      this.messages = [];
    } else if (data.type === "tableDelta") {
      this.tableDelta = data.value;
    } else if (data.type === "tables") {
      this.tables = data.value;
    } else if (data.type === "table") {
      this.tables[data.subtype] = data.value;
    } else if (data.type === "model") {
      if (data.value === "uniform") {
        this.model = uniform;
      } else if (data.value === "triangular") {
        this.model = triangular;
      } else if (data.value === "normal") {
        this.model = normal;
      } else if (data.value === "balanced") {
        this.model = this.balanced.step.bind(this.balanced);
      } else if (data.value === "finite") {
        this.model = this.finite.step.bind(this.finite);
      } else if (data.value === "bit") {
        this.model = this.bit.step.bind(this.bit);
      } else if (data.value === "alternating") {
        this.model = () => { this.alternating = -this.alternating; return this.alternating; };
      } else {
        this.model = rand;
      }
    } else if (data.type === "jitterModel") {
      if (data.value === "uniform") {
        this.jitterModel = uniform;
      } else if (data.value === "triangular") {
        this.jitterModel = triangular;
      } else if (data.value === "normal") {
        this.jitterModel = normal;
      } else if (data.value === "balanced") {
        this.jitterModel = this.jitterBalanced.step.bind(this.jitterBalanced);
      } else if (data.value === "finite") {
        this.jitterModel = this.jitterFinite.step.bind(this.jitterFinite);
      } else if (data.value === "bit") {
        this.jitterModel = this.jitterBit.step.bind(this.jitterBit);
      } else if (data.value === "alternating") {
        this.jitterModel = () => { this.jitterAlternating = -this.jitterAlternating; return this.jitterAlternating };
      } else {
        this.jitterModel = rand;
      }
    } else if (data.type === "jitterType") {
      this.jitterType = data.value;
    } else if (data.type === "finiteLength") {
      this.finite.length = data.value;
    } else if (data.type === "finiteSeed") {
      this.finite.seed = data.value;
    } else if (data.type === "bitDepth") {
      this.bit.depth = data.value;
    } else if (data.type === "jitterFiniteLength") {
      this.jitterFinite.length = data.value;
    } else if (data.type === "jitterFiniteSeed") {
      this.jitterFinite.seed = data.value;
    } else if (data.type === "jitterBitDepth") {
      this.jitterBit.depth = data.value;
    } else if (data.type === "diffStages") {
      this.diffs = Array(data.value).fill(0);
      for (let i = 0; i < data.value; ++i) {
        this.generateValue();
      }
    } else if (data.type === "linear") {
      this.linear = data.value;
    } else if (data.type === "underSampling") {
      this.underSampling = data.value;
    } else {
      throw `Unrecognized message ${data.type}`;
    }
  }

  generateValue() {
    let newValue = this.model();
    let oldValue;
    for (let j = 0; j < this.diffs.length; ++j) {
      oldValue = this.diffs[j];
      this.diffs[j] = newValue;
      newValue = newValue - oldValue;
    }

    this.y0 = this.y1;
    this.y1 = newValue / (1 << this.diffs.length);  // Compensate for [-1, 1] range
  }

  process(inputs, outputs, parameters) {
    let t = currentTime;
    const output = outputs[0];

    const natValues = parameters.nat;
    const jitterValues = parameters.jitter;

    const _dt = 1 / sampleRate;

    const channel = output[0];
    for (let i = 0; i < channel.length; i++) {
      if (this.holdIndex === 0) {
        this.triggerMessages(t);
        const x = this.tOnset / this.tableDelta;

        const dt = _dt * this.underSampling;

        const frequency = Math.exp(
          natValues[Math.min(natValues.length-1, i)] +
          getTableValue(x, this.tables.nat)
        );
        const amplitude = getTableValue(x, this.tables.amplitude);

        const dp = this.speed * frequency * dt;

        let result = this.y1;
        if (this.linear) {
          result = this.y0 + (this.y1 - this.y0) * this.phase;
        }

        this.holdValue = result * amplitude;
        channel[i] = this.holdValue;

        t += dt;
        this.tOnset += dt;
        this.phase += dp;
        if (this.phase > 1) {
          const remainder = (this.phase - 1) / this.speed;

          this.generateValue();

          const jitter = (
            jitterValues[Math.min(jitterValues.length-1, i)] +
            getTableValue(x, this.tables.jitter)
          );
          this.speed = jitter * this.jitterModel();
          if (this.jitterType === "pulseWidth") {
            this.speed = 1 / (1 + Math.max(-0.99, this.speed));
          } else {
            this.speed = Math.exp(this.speed);
          }

          this.phase = (remainder * this.speed) % 1;
        }
      } else {
        channel[i] = this.holdValue;
      }
      this.holdIndex = (this.holdIndex + 1) % this.underSampling;
    }

    for (let j = 1; j < output.length; ++j) {
      for (let i = 0; i < channel.length; ++i) {
        output[j][i] = channel[i];
      }
    }

    return true;
  }
}

registerProcessor('noise', Noise);
