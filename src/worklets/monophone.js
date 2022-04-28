import BaseProcessor from "./base.js";
import { getTableValue } from "../lib/table.js";
import { softSemisine, softSawtooth, softTriangle, softSquare, softSinh, softCosh, softTanh, softLog } from "../lib/waveform/soft.js";

function smoothSawtooth(phase, sharpness) {
  return softSawtooth(phase, Math.sqrt(sharpness));
}

function smoothTriangle(phase, sharpness) {
  return softTriangle(phase, Math.sqrt(sharpness));
}

function smoothSquare(phase, sharpness) {
  return softSquare(phase, Math.sqrt(sharpness));
}

function smoothSinh(phase, sharpness) {
  return softSinh(phase, sharpness*12);
}

function smoothCosh(phase, sharpness) {
  return softCosh(phase, sharpness*12);
}

function smoothTanh(phase, sharpness) {
  return softTanh(phase, sharpness*12);
}

function smoothLog(phase, sharpness) {
  return softLog(phase, 0.99*sharpness);
}

function swing(phase, midpoint) {
  // XXX: Not real swing because we don't add the floor back
  phase -= Math.floor(phase);
  if (phase < midpoint) {
    return 0.5 * phase / midpoint;
  }
  return 0.5 + 0.5 * (phase - midpoint) / (1 - midpoint);
}

class Monophone extends BaseProcessor {

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
        name: 'bias',
        defaultValue: 0,
      },
    ];
  }

  constructor() {
    super();
    // Oscillator phase
    this.phase = 0;

    this.waveform = softSemisine;

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
  }

  applyMessage(msg) {
    if (super.applyMessage(msg)) {
      return;
    }
    const data = msg.data;
    if (data.type === "waveform") {
      if (data.value === "semisine") {
        this.waveform = softSemisine;
      } else if (data.value === "sawtooth") {
        this.waveform = smoothSawtooth;
      } else if (data.value === "triangle") {
        this.waveform = smoothTriangle;
      } else if (data.value === "square") {
        this.waveform = smoothSquare;
      } else if (data.value === "sinh") {
        this.waveform = smoothSinh;
      } else if (data.value === "cosh") {
        this.waveform = smoothCosh;
      } else if (data.value === "tanh") {
        this.waveform = smoothTanh;
      } else if (data.value === "log") {
        this.waveform = smoothLog;
      } else {
        throw `Unrecognized waveform ${data.value}`;
      }
    } else {
      throw `Unrecognized message ${data.type}`;
    }
  }

  processMono(channel, parameters) {
    let t = currentTime;

    const natValues = parameters.nat;
    const timbreValues = parameters.timbre;
    const biasValues = parameters.bias;

    const dt = 1 / sampleRate;

    for (let i = 0; i < channel.length; i++) {
      this.triggerMessages(t);
      const x = this.tOnset / this.tableDelta;

      const frequency = Math.exp(
        natValues[Math.min(natValues.length-1, i)] +
        getTableValue(x, this.tables.nat)
      );
      const timbre = (
        timbreValues[Math.min(timbreValues.length-1, i)] +
        getTableValue(x, this.tables.timbre)
      );
      const bias = (
        biasValues[Math.min(biasValues.length-1, i)] +
        getTableValue(x, this.tables.bias)
      );
      const amplitude = getTableValue(x, this.tables.amplitude);

      // TODO: Make anti-aliasing configurable
      const dp = frequency * dt;
      const midpoint = 0.5 + 0.5*bias;
      const p0 = swing(this.phase, midpoint);
      const p1 = swing(this.phase + 0.5*dp, midpoint);
      const wf = (this.waveform(p0, timbre) + this.waveform(p1, timbre)) * 0.5;
      channel[i] = wf * amplitude;

      t += dt;
      this.tOnset += dt;
      this.phase += dp;
      this.phase -= Math.floor(this.phase);  // Not strictly needed, but improves accuracy
    }
  }
}

registerProcessor('monophone', Monophone);
