import BaseProcessor from "./base.js";
import { getTableValue } from "../lib/table.js";
import { softSemisine, softSawtooth, softTriangle, softSquare, softSinh, softCosh, softTanh, softLog, softPulse, softTent } from "../lib/waveform/soft.js";
import { lissajous21, lissajous13, lissajous23, lissajous25, lissajous34, lissajous35, clip } from "../lib/waveform/lissajous.js";

const TWO_PI = 2 * Math.PI;

function sqrt(x) {
  return Math.sqrt(Math.max(0, x));
}

function smoothSemisine(phase, sharpness) {
  return softSemisine(phase - 0.25, sharpness);
}

function smoothSawtooth(phase, sharpness) {
  return softSawtooth(phase, sqrt(sharpness));
}

function smoothTriangle(phase, sharpness) {
  return softTriangle(phase, sqrt(sharpness));
}

function smoothSquare(phase, sharpness) {
  return softSquare(phase, sqrt(sharpness));
}

function smoothSinh(phase, sharpness, bias) {
  return softSinh(phase, sharpness*12, 0.25 - 0.2499 * bias);
}

function smoothCosh(phase, sharpness) {
  return softCosh(phase - 0.25, sharpness*12);
}

function smoothTanh(phase, sharpness) {
  return softTanh(phase + 0.25, sharpness*12);
}

function smoothLog(phase, sharpness) {
  return softLog(phase, 0.99*Math.min(1, sharpness));
}

function smoothPulse(phase, sharpness, bias) {
  return softPulse(phase, sqrt(sharpness), 0.25 - 0.24 * bias);
}

function smoothTent(phase, sharpness, bias) {
  return softTent(phase, sharpness, 0.25 - 0.245 * bias);
}

const BIASABLE = [lissajous21, lissajous13, lissajous23, lissajous25, lissajous34, lissajous35, smoothPulse, smoothTent, smoothSinh];

export function biased(phase, x) {
  phase -= Math.floor(phase + 0.5);
  if (Math.abs(phase) < x) {
    return 0.25 * phase / x;
  }
  if (phase > 0) {
    return 0.25 + 0.25 * (phase - x) / (0.5 - x);
  }
  return 0.25 * (phase + x) / (0.5 - x) - 0.25;
}

export class Monophone extends BaseProcessor {

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
    this.differentiated = false;
    // Low-pass state
    this.timbre = 0;
    this.bias = 0;
    this.amplitude = 1;

    this.waveform = smoothPulse;
    this.biasable = BIASABLE.includes(this.waveform);

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
      } else if (data.value === "pulse") {
        this.waveform = smoothPulse;
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
      this.biasable = BIASABLE.includes(this.waveform);
    } else if (data.type === "differentiated") {
      this.differentiated = data.value;
    } else {
      throw `Unrecognized message ${data.type}`;
    }
  }

  processMono(channel, parameters) {
    let t = currentTime;

    const natValues = parameters.nat;
    const timbreValues = parameters.timbre;
    const biasValues = parameters.bias;

    const dt = this.getDt();
    const a = this.getLowpass(dt);
    const b = 1 - a;

    for (let i = 0; i < channel.length; i++) {
      this.triggerMessages(t);
      const x = this.tOnset / this.tableDelta;

      const frequency = Math.exp(
        natValues[Math.min(natValues.length-1, i)] +
        getTableValue(x, this.tables.nat)
      );
      const timbreTarget = (
        timbreValues[Math.min(timbreValues.length-1, i)] +
        getTableValue(x, this.tables.timbre)
      );
      const biasTarget = (
        biasValues[Math.min(biasValues.length-1, i)] +
        getTableValue(x, this.tables.bias)
      );
      const amplitudeTarget = getTableValue(x, this.tables.amplitude);

      const timbre = this.timbre = this.timbre * a + timbreTarget * b;
      const bias = this.bias = clip(this.bias * a + biasTarget * b, 0, 1);
      const amplitude = this.amplitude = this.amplitude * a + amplitudeTarget * b;

      // TODO: Make anti-aliasing configurable
      const dp = frequency * dt;
      let wf;
      if (this.biasable) {
        if (this.differentiated) {
          wf = (this.waveform(this.phase + dp, timbre, bias) - this.waveform(this.phase, timbre, bias)) / (dp * TWO_PI);
        } else {
          wf = (this.waveform(this.phase, timbre, bias) + this.waveform(this.phase + 0.5*dp, timbre, bias)) * 0.5;
        }
      } else {
        const b = 0.25 + 0.25*bias;
        if (this.differentiated) {
          const p0 = biased(this.phase, b);
          const p1 = biased(this.phase + dp, b);
          wf = (this.waveform(p1, timbre) - this.waveform(p0, timbre)) / (dp * TWO_PI);
        } else {
          const p0 = biased(this.phase, b);
          const p1 = biased(this.phase + 0.5*dp, b);
          wf = (this.waveform(p0, timbre) + this.waveform(p1, timbre)) * 0.5;
        }
      }
      channel[i] = wf * amplitude;

      t += dt;
      this.tOnset += dt;
      this.phase += dp;
      this.phase -= Math.floor(this.phase);  // Not strictly needed, but improves accuracy
    }
  }
}

// Registered in subclass module to avoid double call
// registerProcessor('monophone', Monophone);
