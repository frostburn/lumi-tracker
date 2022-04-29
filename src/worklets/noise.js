import BaseProcessor from "./base.js";
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

class Logistic {
  constructor(r=4) {
    this.x = Math.random();
    this.r = r;
  }

  step() {
    this.x = this.r * this.x * (1 - this.x);
    if (isNaN(this.x) || this.x <= 0 || this.x >= 1) {
      this.x = Math.random();
    }
    // Roughly normalize to [-1, 1] range for r > 3.55
    // TODO: Improve and simplify
    const u = (this.r - 3.55) / (4 - 3.55);
    const xMax = 0.888 + u*(1 - 0.888);
    const xMin = 0.354 - u*0.354 + u*(1-u)*0.097;
    return 2*(this.x - xMin) / (xMax - xMin) - 1;
  }
}

class Noise extends BaseProcessor {

  // Static getter to define AudioParam objects in this custom processor.
  static get parameterDescriptors() {
    return [
      { /* Pitch in natural units with 1Hz base frequency */
        name: 'nat',
        defaultValue: 0,
      },
      {
        name: 'timbre',
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
    // Normalized time since last value change
    this.phase = 0;
    // Lowpass state
    this.amplitude = 1;

    this.model = rand;
    this.modelType = "rand";
    this.jitterModel = rand;

    this.finite = new Finite();
    this.balanced = new Balanced();
    this.bit = new Bit();
    this.logistic = new Logistic();
    this.alternating = 1;

    this.jitterFinite = new Finite();
    this.jitterBalanced = new Balanced();
    this.jitterBit = new Bit();
    this.jitterLogistic = new Logistic();
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
      timbre: {
        linear: false,
        loopStart: 0,
        data: [0],
      },
      bias: {
        linear: false,
        loopStart: 0,
        data: [0],
      },
    };

    this.messages = [];
    this.port.onmessage = this.onMessage.bind(this);
  }

  applyMessage(msg) {
    const data = msg.data;
    if (data.type === "onset") {
      this.finite.reset();
      this.alternating = 1;
      this.jitterFinite.reset();
      this.jitterAlternating = 1;
    }
    if (super.applyMessage(msg)) {
      return;
    }
    if (data.type === "model") {
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
      } else if (data.value === "logistic") {
        this.model = this.logistic.step.bind(this.logistic);
      } else if (data.value === "alternating") {
        this.model = () => { this.alternating = -this.alternating; return this.alternating; };
      } else {
        this.model = rand;
      }
      this.modelType = data.value;
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
      } else if (data.value === "logistic") {
        this.jitterModel = this.jitterLogistic.step.bind(this.jitterLogistic);
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
    } else if (data.type === "jitterLogisticR") {
      this.jitterLogistic.r = data.value;
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

  generateValue(timbre) {
    let newValue = this.model();
    if (this.modelType === "logistic") {
      this.logistic.r = 3.55 + timbre * (4 - 3.55);
    } else {
      timbre = 16*timbre + EPSILON;
      newValue = Math.sinh(newValue * timbre) / Math.sinh(timbre);
    }
    let oldValue;
    for (let j = 0; j < this.diffs.length; ++j) {
      oldValue = this.diffs[j];
      this.diffs[j] = newValue;
      newValue = newValue - oldValue;
    }

    this.y0 = this.y1;
    this.y1 = newValue / (1 << this.diffs.length);  // Compensate for [-1, 1] range
  }

  processMono(channel, parameters) {
    let t = currentTime;

    const natValues = parameters.nat;
    const jitterValues = parameters.jitter;
    const timbreValues = parameters.timbre;

    const _dt = this.getDt();
    const dt = _dt * this.underSampling;
    const a = this.getLowpass(dt);
    const b = 1 - a;

    for (let i = 0; i < channel.length; i++) {
      if (this.holdIndex === 0) {
        this.triggerMessages(t);
        const x = this.tOnset / this.tableDelta;

        const frequency = Math.exp(
          natValues[Math.min(natValues.length-1, i)] +
          getTableValue(x, this.tables.nat)
        );
        const amplitudeTarget = getTableValue(x, this.tables.amplitude);
        const amplitude = this.amplitude = this.amplitude * a + amplitudeTarget * b;

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

          const timbre = (
            timbreValues[Math.min(timbreValues.length-1, i)] +
            getTableValue(x, this.tables.timbre)
          );
          this.generateValue(timbre);

          const jitter = (
            jitterValues[Math.min(jitterValues.length-1, i)] +
            getTableValue(x, this.tables.bias)
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
  }
}

registerProcessor('noise', Noise);
