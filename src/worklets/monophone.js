import BaseProcessor from "./base.js";
import { getTableValue } from "../lib/table.js";
import { softSemisine, softSawtooth, softTriangle, softSquare } from "../lib/waveform/soft.js";

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
    }
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
        this.waveform = softSawtooth;
      } else if (data.value === "triangle") {
        this.waveform = softTriangle;
      } else if (data.value === "square") {
        this.waveform = softSquare;
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
      const amplitude = getTableValue(x, this.tables.amplitude);

      // TODO: Make anti-aliasing configurable
      const dp = frequency * dt;
      const wf = (this.waveform(this.phase, timbre) + this.waveform(this.phase + 0.5*dp, timbre)) * 0.5;
      channel[i] = wf * amplitude;

      t += dt;
      this.tOnset += dt;
      this.phase += dp;
      this.phase -= Math.floor(this.phase);  // Not strictly needed, but improves accuracy
    }
  }
}

registerProcessor('monophone', Monophone);
