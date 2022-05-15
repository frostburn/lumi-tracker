import { getTableValue } from "../lib/table.js";
import { clip } from "../lib/waveform/lissajous.js";
import { Monophone, biased } from "./monophone.js";

const TWO_PI = 2 * Math.PI;

class Polyphone extends Monophone {
  constructor() {
    super();
    delete this.phase;
    delete this.timbre;
    delete this.bias;
    delete this.amplitude;
    const dt = this.getDt();
    this.attackDecay = 0.1**dt;
    this.releaseDecay = 0.001**dt;
    this.voices = new Map();
  }

  applyMessage(msg) {
    const data = msg.data;
    if (data.type === "onset") {
      const voice = this.voices.get(data.id) || {};
      voice.tOnset = 0;
      voice.tOffset = -1;
      voice.nats = data.nats;
      voice.velocity = data.velocity;

      voice.timbre = voice.timbre || getTableValue(0, this.tables.timbre);
      voice.bias = voice.bias || getTableValue(0, this.tables.bias);
      voice.amplitude = voice.amplitude || getTableValue(0, this.tables.amplitude);
      voice.envelope = voice.envelope || 0;
      voice.phase = voice.phase || 0;
      this.voices.set(data.id, voice);
      return;
    }
    if (data.type === "offset") {
      const voice = this.voices.get(data.id);
      voice.tOffset = 0;
      return;
    }
    if (data.type === "attack") {
      const dt = this.getDt();
      this.attackDecay = 0.3**(dt / data.value);
      return;
    }
    if (data.type === "release") {
      const dt = this.getDt();
      this.releaseDecay = 0.3**(dt / data.value);
      return;
    }
    super.applyMessage(msg);
    if (data.type === "cancel") {
      this.voices.clear();
    }
  }

  processMono(channel, parameters) {
    let t = currentTime;
    const dt = this.getDt();

    if (!this.voices.size) {
      for (let i = 0; i < channel.length; i++) {
        this.triggerMessages(t);
        t += dt;
      }
      return;
    }

    const natValues = parameters.nat;
    const timbreValues = parameters.timbre;
    const biasValues = parameters.bias;

    const a = this.getLowpass(dt);
    const b = 1 - a;

    for (let i = 0; i < channel.length; i++) {
      this.triggerMessages(t);

      const globalNat = natValues[Math.min(natValues.length-1, i)];
      const globalTimbre = timbreValues[Math.min(timbreValues.length-1, i)];
      const globalBias = biasValues[Math.min(biasValues.length-1, i)];

      channel[i] = 0;

      for (let [id, voice] of this.voices) {
        if (voice.tOffset > 1 && voice.envelope < 0.0001) {
          this.voices.delete(id);
          continue;
        }

        const x = voice.tOnset / this.tableDelta;
        const frequency = Math.exp(voice.nats + globalNat + getTableValue(x, this.tables.nat));
        const timbreTarget = globalTimbre + getTableValue(x, this.tables.timbre);
        const biasTarget = globalBias + getTableValue(x, this.tables.bias);
        const amplitudeTarget = getTableValue(x, this.tables.amplitude);

        const timbre = voice.timbre = voice.timbre * a + timbreTarget * b;
        const bias = voice.bias = clip(voice.bias * a + biasTarget * b, 0, 1);
        const amplitude = voice.amplitude = voice.amplitude * a + amplitudeTarget * b;

        if (voice.tOffset < 0) {
          // Attack
          voice.envelope = (1 - this.attackDecay)*voice.velocity + this.attackDecay*voice.envelope;
        } else {
          // Release
          voice.envelope *= this.releaseDecay;
          voice.tOffset += dt;
        }

        const dp = frequency * dt;
        let wf;
        if (this.biasable) {
          if (this.differentiated) {
            wf = (this.waveform(voice.phase + dp, timbre, bias) - this.waveform(voice.phase, timbre, bias)) / (dp * TWO_PI);
          } else {
            wf = (this.waveform(voice.phase, timbre, bias) + this.waveform(voice.phase + 0.5*dp, timbre, bias)) * 0.5;
          }
        } else {
          const b = 0.25 + 0.25*bias;
          if (this.differentiated) {
            const p0 = biased(voice.phase, b);
            const p1 = biased(voice.phase + dp, b);
            wf = (this.waveform(p1, timbre) - this.waveform(p0, timbre)) / (dp * TWO_PI);
          } else {
            const p0 = biased(voice.phase, b);
            const p1 = biased(voice.phase + 0.5*dp, b);
            wf = (this.waveform(p0, timbre) + this.waveform(p1, timbre)) * 0.5;
          }
        }

        channel[i] += wf * amplitude * voice.envelope;

        voice.tOnset += dt;
        voice.phase += dp;
        voice.phase -= Math.floor(voice.phase);
      }

      t += dt;
    }
  }
}

registerProcessor('monophone', Monophone);  // XXX: Not ideal, but what are you going to do.
registerProcessor('polyphone', Polyphone);
