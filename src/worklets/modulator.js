import BaseProcessor from "./base.js";
import { getTableValue } from "../lib/table.js";
import { softTriangle } from "../lib/waveform/soft.js";

class Modulator extends BaseProcessor {

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
    super({numberOfOutputs: 2});
    // Oscillator phase
    this.phase = 0;
    this.modulatorFactor = 1;
    this.carrierFactor = 1;
    // Low-pass state
    this.timbre = 0;
    this.bias = 0;
    this.amplitude = 1;

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
    if (data.type === "modulatorFactor") {
      this.modulatorFactor = data.value;
    } else if (data.type === "carrierFactor") {
      this.carrierFactor = data.value;
    } else {
      throw `Unrecognized message ${data.type}`;
    }
  }

  process(inputs, outputs, parameters) {
    let t = currentTime;

    const natValues = parameters.nat;
    const timbreValues = parameters.timbre;
    const biasValues = parameters.bias;

    const dt = this.getDt();
    const a = this.getLowpass(dt);
    const b = 1 - a;

    const frequencyChannel = outputs[0][0];
    const envelopeChannel = outputs[1][0];
    for (let i = 0; i < frequencyChannel.length; ++i) {
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
      const bias = this.bias = this.bias * a + biasTarget * b;
      const amplitude = this.amplitude = this.amplitude * a + amplitudeTarget * b;

      // TODO: Configure anti-alias
      const dp = frequency * dt * this.modulatorFactor;
      const modulator = softTriangle(this.phase, bias) + softTriangle(this.phase + 0.5 * dp, bias);
      frequencyChannel[i] = frequency * (this.carrierFactor + modulator * timbre * 3);
      envelopeChannel[i] = amplitude;

      t += dt;
      this.tOnset += dt;
      this.phase += dp;
      this.phase -= Math.floor(this.phase);  // Not strictly needed, but improves accuracy
    }
    return true;
  }
}

registerProcessor('modulator', Modulator);
