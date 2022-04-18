import JKISS31 from "../lib/jkiss.js";
import getTableValue from "../lib/table.js";

const EPSILON = 1e-6;

const jkiss31 = new JKISS31();
jkiss31.scramble();

function jkiss() {
  return jkiss31.step01() * 2 - 1;
}

function rand() {
  return Math.random() * 2 - 1;
}

function normal() {
  return jkiss31.normal();
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

    this.pre = [];
    this.post = [this.model()];

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

    this.port.onmessage = this.onMessage.bind(this);
  }

  onMessage(msg) {
    const data = msg.data;
    if (data.type === "onset") {
      // TODO: Pre-scheduling
      this.tOnset = 0;
    } else if (data.type === "tableDelta") {
      this.tableDelta = data.value;
    } else if (data.type === "table") {
      this.tables[data.subtype] = data.value;
    } else if (data.type === "model") {
      if (data.value === "jkiss") {
        this.model = jkiss;
      } else if (data.value === "normal") {
        this.model = normal;
      } else {
        this.model = rand;
      }
    } else if (data.type === "preStages") {
      this.pre = Array(data.value).fill(0);
      for (let i = 0; i < data.value; ++i) {
        this.generateValue();
      }
    } else if (data.type === "postStages") {
      this.post = Array(data.value+1).fill(0);
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
    const output = outputs[0];

    const natValues = parameters.nat;
    const jitterValues = parameters.jitter;

    const dt = 1 / sampleRate;

    const channel = output[0];
    for (let i = 0; i < channel.length; i++) {
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

      channel[i] = this.post[0];

      this.tOnset += dt;
      this.phase += dp;
      if (this.phase > 1) {
        this.phase %= 1;

        this.generateValue();

        const jitter = (
          jitterValues[Math.min(jitterValues.length-1, i)] +
          getTableValue(x, this.tables.jitter)
        );
        this.speed = jitter * this.model();
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
