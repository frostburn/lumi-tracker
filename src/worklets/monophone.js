import { getTableValue } from "../lib/table.js";
import { softSemisine, softSawtooth, softTriangle, softSquare } from "../lib/waveform/soft.js";

// TODO: TableWorklet superclass
class Monophone extends AudioWorkletProcessor {

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
    // Time since last onset
    this.tOnset = 0;
    // Oscillator phase
    this.phase = 0;
    // Inverse speed of parameter change
    this.tableDelta = 0.02;

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
    } else if (data.type === "cancel") {
      this.messages = [];
    } else if (data.type === "tableDelta") {
      this.tableDelta = data.value;
    } else if (data.type === "tables") {
      this.tables = data.value;
    } else if (data.type === "table") {
      this.tables[data.subtype] = data.value;
    } else if (data.type === "waveform") {
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

  process(inputs, outputs, parameters) {
    let t = currentTime;
    const output = outputs[0];

    const natValues = parameters.nat;
    const timbreValues = parameters.timbre;

    const dt = 1 / sampleRate;

    const channel = output[0];
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

      channel[i] = this.waveform(this.phase, timbre) * amplitude;

      t += dt;
      this.tOnset += dt;
      this.phase += frequency * dt;
      this.phase -= Math.floor(this.phase);  // Not strictly needed, but improves accuracy
    }

    for (let j = 1; j < output.length; ++j) {
      for (let i = 0; i < channel.length; ++i) {
        output[j][i] = channel[i];
      }
    }

    return true;
  }
}

registerProcessor('monophone', Monophone);
