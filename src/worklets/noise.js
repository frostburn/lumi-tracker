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

class Finite {
  constructor(length, seed) {
    this.length = length;
    this.seed = seed;
    this.generator = new JKISS31(seed);
    this.index = 0;
  }

  step() {
    if (this.index >= this.length) {
      this.generator.seed(this.seed);
      this.index = 0;
    }
    this.index++;
    return this.generator.step01() * 2 - 1;
  }
}

const LEAK = 0.9;

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

    this.finiteLength = 8;
    this.finiteSeed = 0;
    this.jitterFiniteLength = 8;
    this.jitterFiniteSeed = 0;

    this.pre = [];
    this.post = [this.model()];

    this.jitterType = "pitch";
    this.speed = 0;

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
      } else if (data.value === "finite") {
        this._generator = new Finite(this.finiteLength, this.finiteSeed);
        this.model = () => this._generator.step();
      } else if (data.value === "alternating") {
        this._generator = -1
        this.model = () => {this._generator = -this._generator; return this._generator};
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
      } else if (data.value === "finite") {
        this._jitterGenerator = new Finite(this.jitterFiniteLength, this.jitterFiniteSeed);
        this.jitterModel = () => this._jitterGenerator.step();
      } else if (data.value === "alternating") {
        this._jitterGenerator = -1;
        this.jitterModel = () => {this._jitterGenerator = -this._jitterGenerator; return this._jitterGenerator};
      } else {
        this.jitterModel = rand;
      }
    } else if (data.type === "jitterType") {
      this.jitterType = data.value;
    } else if (data.type === "finiteLength") {
      this.finiteLength = data.value;
    } else if (data.type === "finiteSeed") {
      this.finiteSeed = data.value;
    } else if (data.type === "jitterFiniteLength") {
      this.jitterFiniteLength = data.value;
    } else if (data.type === "jitterFiniteSeed") {
      this.jitterFiniteSeed = data.value;
    } else if (data.type === "preStages") {
      this.pre = Array(data.value).fill(0);
      for (let i = 0; i < data.value; ++i) {
        this.generateValue();
      }
    } else if (data.type === "postStages") {
      this.post = Array(data.value+1).fill(0);
    } else {
      throw `Unrecognized message ${data.type}`;
    }
  }

  generateValue() {
    let newValue = this.model();
    let oldValue;
    for (let j = 0; j < this.pre.length; ++j) {
      oldValue = this.pre[j];
      this.pre[j] = newValue;
      newValue = newValue - oldValue;
    }

    this.post[this.post.length - 1] = newValue;
  }

  process(inputs, outputs, parameters) {
    let t = currentTime;
    const output = outputs[0];

    const natValues = parameters.nat;
    const jitterValues = parameters.jitter;

    const dt = 1 / sampleRate;

    const channel = output[0];
    for (let i = 0; i < channel.length; i++) {
      this.triggerMessages(t);
      const x = this.tOnset / this.tableDelta;

      const frequency = Math.exp(
        natValues[Math.min(natValues.length-1, i)] +
        getTableValue(x, this.tables.nat) +
        this.speed
      );
      const amplitude = getTableValue(x, this.tables.amplitude);

      const dp = frequency * dt;
      const dl = LEAK**dp;

      // TODO: Volume compensation for high frequencies or more accurate integration.
      for (let j = 0; j < this.post.length - 1; ++j) {
        this.post[j] = this.post[j] * dl + this.post[j+1] * dp;
      }

      channel[i] = this.post[0] * amplitude;

      t += dt;
      this.tOnset += dt;
      this.phase += dp;
      if (this.phase > 1) {
        this.phase %= 1;

        this.generateValue();

        const jitter = (
          jitterValues[Math.min(jitterValues.length-1, i)] +
          getTableValue(x, this.tables.jitter)
        );
        this.speed = jitter * this.jitterModel();
        if (this.jitterType === "pulseWidth") {
          this.speed = -Math.log(Math.max(0.01, 1 + this.speed));
        }
      }
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
