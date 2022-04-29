import { ratioToCents } from "./util.js";
import PROGRAMS from "./presets/programs.js";
import noiseWorkletURL from "/src/worklets/noise.js?url"
import monophoneWorkletURL from "/src/worklets/monophone.js?url"

let AUDIO_CTX;
// WebAudio API especially on Firefox doesn't perfectly sync AUDIO_CTX.currentTime
// with what's actually being heard. This causes clicks. This delay should help.
let AUDIO_DELAY = 0.0;

// WebAudio API seems to have a bug where oscillators are not garbage collected.
// Use a banking system to reuse oscillators as much as possible.
const OSCILLATOR_BANK = [];
// Not sure about AudioWorkletNode either so let's play it safe and bank them as well.
const NOISE_BANK = [];
const MONOPHONE_BANK = [];

const DEFAULT_OSCILLATOR_WAVEFORMS = ["sine", "square", "sawtooth", "triangle"];
const PERIODIC_WAVES = {};

export function availableOscillatorWaveforms() {
    const result = Object.keys(PERIODIC_WAVES).concat(DEFAULT_OSCILLATOR_WAVEFORMS);
    result.sort();
    return result;
}

export function availableWaveforms() {
    return [
        "pulse", "tent", "semisine", "sawtooth", "square", "triangle",
        "sinh", "cosh", "tanh", "log",
        "Lissajous 2 1", "Lissajous 1 3", "Lissajous 2 3", "Lissajous 2 5", "Lissajous 3 4", "Lissajous 3 5"
    ];
}

export function availableNoiseModels() {
    return ["uniform", "triangular", "normal", "balanced", "bit", "finite", "logistic", "alternating", "built-in"];
}

export function setOscillatorWaveform(oscillator, waveform) {
    if (DEFAULT_OSCILLATOR_WAVEFORMS.includes(waveform)) {
        oscillator.type = waveform;
    } else {
        oscillator.setPeriodicWave(PERIODIC_WAVES[waveform]);
    }
}

export function getAudioContext() {
    if (AUDIO_CTX === undefined) {
        AUDIO_CTX = new AudioContext({latencyHint: "interactive"});
        AUDIO_CTX.suspend();
        createWaveforms();
    }
    return AUDIO_CTX;
}

export async function loadAudioWorklets() {
    const ctx = getAudioContext();
    // Relative to index.html
    await ctx.audioWorklet.addModule(noiseWorkletURL);
    await ctx.audioWorklet.addModule(monophoneWorkletURL);
}

export function suspendAudio() {
    const ctx = getAudioContext();
    ctx.suspend();
}

export function resumeAudio() {
    const ctx = getAudioContext();
    ctx.resume();
}

export function setAudioDelay(value) {
    AUDIO_DELAY = value;
}

export function safeNow() {
    const ctx = getAudioContext();
    return ctx.currentTime + AUDIO_DELAY;
}

function obtainOscillator(waveform="sine") {
    let oscillator;
    if (OSCILLATOR_BANK.length) {
        oscillator = OSCILLATOR_BANK.pop();
    } else {
        const ctx = getAudioContext();
        oscillator = ctx.createOscillator();
        oscillator.start(ctx.currentTime);
    }
    setOscillatorWaveform(oscillator, waveform);
    return oscillator;
}

function disposeOscillator(oscillator) {
    const ctx = getAudioContext();
    oscillator.frequency.cancelScheduledValues(ctx.currentTime);
    oscillator.detune.cancelScheduledValues(ctx.currentTime);
    oscillator.disconnect();
    OSCILLATOR_BANK.push(oscillator);
}

function obtainNoise(
        model="uniform", jitterModel="balanced", jitterType="pulseWidth",
        bitDepth=1, finiteLength=8, finiteSeed=0, underSampling=1,
        jitterBitDepth=1, jitterFiniteLength=8, jitterFiniteSeed=0, jitterLogisticR=4,
        diffStages=0, linear=false, tableDelta=0.02, tables=PROGRAMS.P0,
    ) {
    const ctx = getAudioContext();
    let noise;
    if (NOISE_BANK.length) {
        noise = NOISE_BANK.pop();
    } else {
        noise = new AudioWorkletNode(ctx, "noise");
    }
    noise.parameters.get("jitter").setValueAtTime(0, ctx.currentTime);
    noise.parameters.get("timbre").setValueAtTime(0, ctx.currentTime);
    noise.port.postMessage({ type: "model", value: model });
    noise.port.postMessage({ type: "jitterModel", value: jitterModel });
    noise.port.postMessage({ type: "jitterType", value: jitterType });
    noise.port.postMessage({ type: "bitDepth", value: bitDepth });
    noise.port.postMessage({ type: "finiteLength", value: finiteLength });
    noise.port.postMessage({ type: "finiteSeed", value: finiteSeed });
    noise.port.postMessage({ type: "jitterBitDepth", value: jitterBitDepth });
    noise.port.postMessage({ type: "jitterFiniteLength", value: jitterFiniteLength });
    noise.port.postMessage({ type: "jitterFiniteSeed", value: jitterFiniteSeed });
    noise.port.postMessage({ type: "jitterLogisticR", value: jitterLogisticR });
    noise.port.postMessage({ type: "diffStages", value: diffStages });
    noise.port.postMessage({ type: "linear", value: linear });
    noise.port.postMessage({ type: "underSampling", value: underSampling });
    noise.port.postMessage({ type: "tableDelta", value: tableDelta });
    noise.port.postMessage({ type: "tables", value: tables });

    return noise;
}

function disposeNoise(noise) {
    const ctx = getAudioContext();
    noise.port.postMessage({type: "cancel"});
    noise.parameters.get("nat").cancelScheduledValues(ctx.currentTime);
    noise.parameters.get("jitter").cancelScheduledValues(ctx.currentTime);
    noise.parameters.get("timbre").cancelScheduledValues(ctx.currentTime);
    noise.disconnect();
    NOISE_BANK.push(noise);
}

function obtainMonophone(
        waveform="semisine", tableDelta=0.02, tables=PROGRAMS.P0,
    ) {
    const ctx = getAudioContext();
    let monophone;
    if (MONOPHONE_BANK.length) {
        monophone = MONOPHONE_BANK.pop();
    } else {
        monophone = new AudioWorkletNode(ctx, "monophone");
    }
    monophone.parameters.get("timbre").setValueAtTime(0, ctx.currentTime);
    monophone.parameters.get("bias").setValueAtTime(0, ctx.currentTime);
    monophone.port.postMessage({ type: "waveform", value: waveform });
    monophone.port.postMessage({ type: "tableDelta", value: tableDelta });
    monophone.port.postMessage({ type: "tables", value: tables });

    return monophone;
}

function disposeMonophone(monophone) {
    const ctx = getAudioContext();
    monophone.port.postMessage({type: "cancel"});
    monophone.parameters.get("nat").cancelScheduledValues(ctx.currentTime);
    monophone.parameters.get("timbre").cancelScheduledValues(ctx.currentTime);
    monophone.parameters.get("bias").cancelScheduledValues(ctx.currentTime);
    monophone.disconnect();
    MONOPHONE_BANK.push(monophone);
}

export function scheduleAction(when, action) {
    const ctx = getAudioContext();
    const dummy = ctx.createConstantSource();
    dummy.start(ctx.currentTime);
    dummy.stop(when);
    dummy.addEventListener("ended", action);

    function fire(time) {
        dummy.stop(time);
    }
    function cancel() {
        dummy.removeEventListener("ended", action);
    }
    return [fire, cancel];
}

// Set up custom waveforms. Adapted from:
// https://github.com/SeanArchibald/scale-workshop/blob/master/src/js/synth/Synth.js
function createWaveforms() {
    PERIODIC_WAVES["warm1"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 2, 2, 2, 1, 1, 0.5, 0.1, 0.02]),
        new Float32Array([0,  0, 0, 0, 0, 0, 0, 0.0, 0.0, 0.00])
    )
    PERIODIC_WAVES["warm2"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 5, 3.33, 2, 1, 0.2, 0.1, 0.02]),
        new Float32Array([0,  0, 0, 0.00, 0, 0, 0.0, 0.0, 0.00])
    )
    PERIODIC_WAVES["warm3"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 5, 5, 3, 0.2, 0.1, 0.02]),
        new Float32Array([0,  0, 0, 0, 0, 0.0, 0.0, 0.00])
    )
    PERIODIC_WAVES["warm4"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 2, 2, 1, 0.1, 0.02]),
        new Float32Array([0,  0, 0, 0, 0, 0.0, 0.00])
    )
    PERIODIC_WAVES["octaver"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0,100,50,0,33,0,0,0,25,0,0,0,0,0,0,0,16]),
        new Float32Array([0,  0, 0,0, 0,0,0,0, 0,0,0,0,0,0,0,0, 0])
    )
    PERIODIC_WAVES["brightness"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0,10,0,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,.75,.5,.2,.1,0.02]),
        new Float32Array([0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,.00,.0,.0,.0,0.00])
    )
    PERIODIC_WAVES["harmonicbell"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 2, 2, 2, 2,0,0,0,0,0,7]),
        new Float32Array([0,  0, 0, 0, 0, 0,0,0,0,0,0,0])
    )

    // DC-blocked semisine
    const semisineSineComponents = new Float32Array(64);
    const semisineCosineComponents = new Float32Array(64);
    for (let n = 1; n < 64; ++n) {
        semisineCosineComponents[n] = 1 / (1 - 4*n*n);
    }
    PERIODIC_WAVES["semisine"] = AUDIO_CTX.createPeriodicWave(
        semisineSineComponents,
        semisineCosineComponents
    );

    // Elliptic Theta 3
    [1, 0.5, 0.25, 0.1, 0.05].forEach((softness, index) => {
        const harmonics = [0];
        let i = 1;
        let value;
        do {
            value = Math.exp(-softness*i*i);
            harmonics.push(value);
            i += 1;
        } while(value > 0.0001);
        const zeroComponents = Array(harmonics.length).fill(0);
        PERIODIC_WAVES["theta" + (index+1)] = AUDIO_CTX.createPeriodicWave(new Float32Array(zeroComponents), new Float32Array(harmonics));

        for (let i = 0; i < harmonics.length; i += 2) {
            harmonics[i] = 0;
        }
        PERIODIC_WAVES["oddtheta" + (index+1)] = AUDIO_CTX.createPeriodicWave(new Float32Array(harmonics), new Float32Array(zeroComponents));
    });
}

export function playFrequencies(cells, instrument, beatDuration, destination) {
    const ctx = getAudioContext();
    const oscillator = obtainOscillator(instrument.waveform);
    oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
    const amplitude = ctx.createGain();
    amplitude.gain.setValueAtTime(0.0, ctx.currentTime);
    oscillator.connect(amplitude).connect(destination);
    let lastFrequency = null;
    let time = safeNow();
    cells.forEach(cell => {
        if (cell.frequency !== null) {
            const cents = ratioToCents(cell.frequency*0.001);
            if (lastFrequency === null) {
                oscillator.detune.setValueAtTime(cents, time);
            } else {
                oscillator.detune.setTargetAtTime(cents, time, instrument.frequencyGlide);
            }
        }
        lastFrequency = cell.frequency;
        amplitude.gain.setTargetAtTime(cell.velocity, time, instrument.amplitudeGlide);
        time += beatDuration;
    });
    amplitude.gain.setTargetAtTime(0.0, time, instrument.amplitudeGlide);

    const [cancel, _] = scheduleAction(time + instrument.amplitudeGlide*4, () => {
        disposeOscillator(oscillator);
        amplitude.gain.setValueAtTime(0.0, ctx.currentTime);
        amplitude.disconnect();
    });

    return cancel;
}

export class Miniphone {
    constructor(waveform="triangle", frequencyGlide=0.009, amplitudeGlide=0.005) {
        this.frequencyGlide = frequencyGlide;
        this.amplitudeGlide = amplitudeGlide;
        const ctx = getAudioContext();
        this.oscillator = obtainOscillator(waveform);
        this.oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
        this.pitchBend = ctx.createConstantSource();
        this.pitchBend.start(ctx.currentTime);
        this.pitchBend.connect(this.oscillator.detune);
        this.detune = this.pitchBend.offset;
        this.envelope = ctx.createGain();
        this.envelope.gain.setValueAtTime(0, ctx.currentTime);
        this.oscillator.connect(this.envelope);

        this.vibratoGain = ctx.createGain();
        this.vibratoDepth = this.vibratoGain.gain;
        this.vibratoDepth.setValueAtTime(0, ctx.currentTime);
        this.vibratoOscillator = obtainOscillator();
        this.vibratoOscillator.connect(this.vibratoGain).connect(this.oscillator.detune);
        this.vibratoFrequency = this.vibratoOscillator.frequency;
        this.vibratoFrequency.setValueAtTime(7, ctx.currentTime);

        this.stack = [];
        this.stackDepletionTime = -10000;
    }

    connect(destination) {
        return this.envelope.connect(destination);
    }

    dispose() {
        disposeOscillator(this.oscillator);
        disposeOscillator(this.vibratoOscillator);
        this.pitchBend.disconnect();
        this.pitchBend.stop();
    }

    noteOn(frequency, velocity) {
        const cents = ratioToCents(frequency*0.001);
        const ctx = getAudioContext();
        const now = safeNow();
        this.envelope.gain.cancelScheduledValues(now);
        this.envelope.gain.setTargetAtTime(velocity, now, this.amplitudeGlide);
        if (this.stack.length) {
            this.oscillator.detune.setTargetAtTime(cents, now, this.frequencyGlide);
        } else {
            const decayDuration = now - this.stackDepletionTime;
            const releaseDuration = this.amplitudeGlide * 1.75;
            if (decayDuration < releaseDuration) {
                this.oscillator.detune.setTargetAtTime(
                    cents,
                    now,
                    Math.min(this.frequencyGlide, releaseDuration - decayDuration) * 0.5
                );
            } else {
                this.oscillator.detune.setValueAtTime(cents, now);
            }
        }
        const id = Symbol();
        const voice = {cents, velocity, id};
        this.stack.push(voice);

        function noteOff() {
            const then = safeNow();
            if (!this.stack.length) {
                console.warn("Note off with an empty stack");
                this.envelope.gain.setTargetAtTime(0, then, this.amplitudeGlide);
            }
            if (this.stack[this.stack.length - 1].id === id) {
                this.stack.pop();
                if (!this.stack.length) {
                    this.envelope.gain.setTargetAtTime(0, then, this.amplitudeGlide);
                    this.stackDepletionTime = then;
                    return;
                }
                const topVoice = this.stack[this.stack.length - 1];
                this.oscillator.detune.setTargetAtTime(topVoice.cents, then, this.frequencyGlide);
                this.envelope.gain.setTargetAtTime(topVoice.velocity, then, this.amplitudeGlide);
            } else {
                this.stack.splice(this.stack.indexOf(voice), 1);
            }
        }

        return noteOff.bind(this);
    }
}

class MonophonicBase {
    constructor(frequencyGlide=0.001, attack=0.001, release=0.001) {
        this.frequencyGlide = frequencyGlide;
        this.attack = attack;
        this.release = release;
        const ctx = getAudioContext();
        this._centsToNats = ctx.createGain();
        this._centsToNats.gain.setValueAtTime(Math.log(2)/1200, ctx.currentTime);
        this.pitchBend = ctx.createConstantSource();
        this.pitchBend.start(ctx.currentTime);
        this.pitchBend.connect(this._centsToNats);
        this.detune = this.pitchBend.offset;
        this.envelope = ctx.createGain();
        this.envelope.gain.setValueAtTime(0, ctx.currentTime);

        this.vibratoGain = ctx.createGain();
        this.vibratoDepth = this.vibratoGain.gain;
        this.vibratoDepth.setValueAtTime(0, ctx.currentTime);
        this.vibratoOscillator = obtainOscillator();
        this.vibratoOscillator.connect(this.vibratoGain).connect(this._centsToNats);
        this.vibratoFrequency = this.vibratoOscillator.frequency;
        this.vibratoFrequency.setValueAtTime(7, ctx.currentTime);

        this.stack = [];
        this.stackDepletionTime = -10000;

        this.trackPlaying = false;
        this.lastTrackTime = -10000;
    }

    setConfig(config) {
        this.generator.port.postMessage(config);
    }

    setProgram(program, when) {
        this.setConfig({
            type: "tables",
            value: program,
            when,
        });
    }

    setFullConfig(data) {
        this.frequencyGlide = data.frequencyGlide;
        this.attack = data.attack;
        this.release = data.release;
    }

    connect(destination) {
        return this.envelope.connect(destination);
    }

    dispose() {
        disposeOscillator(this.vibratoOscillator);
        this.pitchBend.disconnect();
        this.pitchBend.stop();
        this.envelope.disconnect();
    }

    trackNoteOn(frequency, velocity, when) {
        if (when < this.lastTrackTime) {
            throw "Causality error during tracking";
        }
        this.lastTrackTime = when;

        const nats = Math.log(frequency);
        this.setConfig({type: "onset", when});
        this.envelope.gain.setTargetAtTime(velocity, when, this.attack);
        if (this.trackPlaying) {
            this.generator.parameters.get("nat").setTargetAtTime(nats, when, this.frequencyGlide);
        } else {
            this.generator.parameters.get("nat").setValueAtTime(nats, when);
            this.trackPlaying = true;
        }
    }

    trackNoteOff(when) {
        if (when < this.lastTrackTime) {
            throw "Causality error during tracking";
        }
        this.lastTrackTime = when;

        this.envelope.gain.setTargetAtTime(0, when, this.release);
        this.trackPlaying = false;
    }

    noteOn(frequency, velocity) {
        const nats = Math.log(frequency);
        const ctx = getAudioContext();
        const now = safeNow();
        this.setConfig({type: "onset", when: now});
        this.envelope.gain.cancelScheduledValues(now);
        this.envelope.gain.setTargetAtTime(velocity, now, this.attack);
        if (this.stack.length) {
            this.generator.parameters.get("nat").setTargetAtTime(nats, now, this.frequencyGlide);
        } else {
            const decayDuration = now - this.stackDepletionTime;
            const releaseDuration = this.release * 1.75;
            if (decayDuration < releaseDuration) {
                this.generator.parameters.get("nat").setTargetAtTime(
                    nats,
                    now,
                    Math.min(this.frequencyGlide, releaseDuration - decayDuration) * 0.5
                );
            } else {
                this.generator.parameters.get("nat").setValueAtTime(nats, now);
            }
        }
        const id = Symbol();
        const voice = {nats, velocity, id};
        this.stack.push(voice);

        function noteOff() {
            const then = safeNow();
            if (!this.stack.length) {
                console.warn("Note off with an empty stack");
                this.envelope.gain.setTargetAtTime(0, then, this.release);
            }
            if (this.stack[this.stack.length - 1].id === id) {
                this.stack.pop();
                if (!this.stack.length) {
                    this.envelope.gain.setTargetAtTime(0, then, this.release);
                    this.stackDepletionTime = then;
                    return;
                }
                const topVoice = this.stack[this.stack.length - 1];
                this.generator.parameters.get("nat").setTargetAtTime(topVoice.nats, then, this.frequencyGlide);
                this.envelope.gain.setTargetAtTime(topVoice.velocity, then, this.attack);
            } else {
                this.stack.splice(this.stack.indexOf(voice), 1);
            }
        }

        return noteOff.bind(this);
    }
}

export class Noise extends MonophonicBase {
    constructor(frequencyGlide=0.001, attack=0.001, release=0.001) {
        super(frequencyGlide, attack, release);
        this.generator = obtainNoise();
        this.jitter = this.generator.parameters.get("jitter");
        this.timbre = this.generator.parameters.get("timbre");
        this._centsToNats.connect(this.generator.parameters.get("nat"));
        this.generator.connect(this.envelope);
    }

    setFullConfig(data) {
        super.setFullConfig(data);
        ["model", "jitterModel", "jitterType", "bitDepth", "finiteLength", "finiteSeed", "jitterBitDepth", "jitterFiniteLength", "jitterFiniteSeed", "jitterLogisticR", "diffStages", "linear", "underSampling", "tableDelta"].forEach(type => {
            super.setConfig({ type, value: data[type] });
        });
    }

    dispose() {
        super.dispose();
        disposeNoise(this.generator);
    }
}

export class Monophone extends MonophonicBase {
    constructor(frequencyGlide=0.001, attack=0.001, release=0.001) {
        super(frequencyGlide, attack, release);
        this.generator = obtainMonophone();
        this.timbre = this.generator.parameters.get("timbre");
        this.bias = this.generator.parameters.get("bias");
        this._centsToNats.connect(this.generator.parameters.get("nat"));
        this.generator.connect(this.envelope);
    }

    setFullConfig(data) {
        super.setFullConfig(data);
        ["waveform", "tableDelta"].forEach(type => {
            this.setConfig({ type, value: data[type] });
        });
    }

    dispose() {
        super.dispose();
        disposeMonophone(this.generator);
    }
}
