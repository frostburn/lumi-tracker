import BaseProcessor from "./base.js";
import { getTableValue } from "../lib/table.js";
import { softSemisine, softSawtooth, softTriangle, softSquare, softSinh, softCosh, softTanh, softLog, softRect, softTent } from "../lib/waveform/soft.js";
import { lissajous21, lissajous13, lissajous23, lissajous25, lissajous34, lissajous35 } from "../lib/waveform/lissajous.js";

function smoothSemisine(phase, sharpness) {
  return softSemisine(phase - 0.25, sharpness);
}

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
  return softCosh(phase - 0.25, sharpness*12);
}

function smoothTanh(phase, sharpness) {
  return softTanh(phase + 0.25, sharpness*12);
}

function smoothLog(phase, sharpness) {
  return softLog(phase, 0.99*sharpness);
}

function smoothRect(phase, sharpness, bias) {
  return softRect(phase, Math.sqrt(sharpness), 0.25 - 0.24 * bias);
}

function smoothTent(phase, sharpness, bias) {
  return softTent(phase, sharpness, 0.25 - 0.245 * bias);
}

const BIASABLE = [lissajous21, lissajous13, lissajous23, lissajous25, lissajous34, lissajous35, smoothRect, smoothTent];

function biased(phase, x) {
  phase -= Math.floor(phase + 0.5);
  if (Math.abs(phase) < x) {
    return 0.25 * phase / x;
  }
  if (phase > 0) {
    return 0.25 + 0.25 * (phase - x) / (0.5 - x);
  }
  return 0.25 * (phase + x) / (0.5 - x) - 0.25;
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

    this.waveform = smoothSemisine;

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
        this.waveform = smoothSemisine;
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
      } else if (data.value === "rect") {
        this.waveform = smoothRect;
      } else if (data.value === "tent") {
        this.waveform = smoothTent;
      } else if (data.value === "Lissajous 2 1") {
        this.waveform = lissajous21;
      } else if (data.value === "Lissajous 1 3") {
        this.waveform = lissajous13;
      } else if (data.value === "Lissajous 2 3") {
        this.waveform = lissajous23;
      } else if (data.value === "Lissajous 2 5") {
        this.waveform = lissajous25;
      } else if (data.value === "Lissajous 3 4") {
        this.waveform = lissajous34;
      } else if (data.value === "Lissajous 3 5") {
        this.waveform = lissajous35;
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
      let wf;
      if (BIASABLE.includes(this.waveform)) {
        wf = (this.waveform(this.phase, timbre, bias) + this.waveform(this.phase + 0.5*dp, timbre, bias)) * 0.5;
      } else {
        const b = 0.25 + 0.25*bias;
        const p0 = biased(this.phase, b);
        const p1 = biased(this.phase + 0.5*dp, b);
        wf = (this.waveform(p0, timbre) + this.waveform(p1, timbre)) * 0.5;
      }
      channel[i] = wf * amplitude;

      t += dt;
      this.tOnset += dt;
      this.phase += dp;
      this.phase -= Math.floor(this.phase);  // Not strictly needed, but improves accuracy
    }
  }
}

registerProcessor('monophone', Monophone);
