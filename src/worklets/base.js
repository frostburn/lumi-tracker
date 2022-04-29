const LOWPASS_TIME_CONSTANT = 0.001;

class BaseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Time since last onset
    this.tOnset = 0;
    // Inverse speed of parameter change
    this.tableDelta = 0.02;

    this.tables = {};

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
      return true;
    }
    if (data.type === "cancel") {
      this.messages = [];
      return true;
    }
    if (data.type === "tableDelta") {
      this.tableDelta = data.value;
      return true;
    }
    if (data.type === "tables") {
      this.tables = data.value;
      return true;
    }
    if (data.type === "table") {
      this.tables[data.subtype] = data.value;
      return true;
    }
    return false;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    this.processMono(output[0], parameters);

    for (let j = 1; j < output.length; ++j) {
      for (let i = 0; i < output[0].length; ++i) {
        output[j][i] = output[0][i];
      }
    }

    return true;
  }

  getDt() {
    return 1 / sampleRate;
  }

  getLowpass(dt) {
    return 0.5**(dt / LOWPASS_TIME_CONSTANT);
  }
}

export default BaseProcessor;
