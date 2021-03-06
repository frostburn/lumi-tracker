import { ratioToCents } from "./util.js";
import PROGRAMS from "./presets/programs.js";

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
const POLYPHONE_BANK = [];
const MODULATOR_BANK = [];

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

    // Monophone registered in polyphone module
    // await ctx.audioWorklet.addModule(new URL("../bundles/monophone.bundle.min.js", import.meta.url));
    await ctx.audioWorklet.addModule(new URL("../bundles/polyphone.bundle.min.js", import.meta.url));
    await ctx.audioWorklet.addModule(new URL("../bundles/modulator.bundle.min.js", import.meta.url));
    await ctx.audioWorklet.addModule(new URL("../bundles/noise.bundle.min.js", import.meta.url));
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
        waveform="pulse", differentiated=false, tableDelta=0.02, tables=PROGRAMS.P0,
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
    monophone.port.postMessage({ type: "differentiated", value: differentiated });
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

function obtainPolyphone(
        waveform="pulse", differentiated=false, attack=0.005, release=0.05, tableDelta=0.02, tables=PROGRAMS.P0,
    ) {
    const ctx = getAudioContext();
    let polyphone;
    if (POLYPHONE_BANK.length) {
        polyphone = POLYPHONE_BANK.pop();
    } else {
        polyphone = new AudioWorkletNode(ctx, "polyphone");
    }
    polyphone.parameters.get("timbre").setValueAtTime(0, ctx.currentTime);
    polyphone.parameters.get("bias").setValueAtTime(0, ctx.currentTime);
    polyphone.port.postMessage({ type: "waveform", value: waveform });
    polyphone.port.postMessage({ type: "differentiated", value: differentiated });
    polyphone.port.postMessage({ type: "attack", value: attack });
    polyphone.port.postMessage({ type: "release", value: release });
    polyphone.port.postMessage({ type: "tableDelta", value: tableDelta });
    polyphone.port.postMessage({ type: "tables", value: tables });

    return polyphone;
}

function disposePolyphone(polyphone) {
    const ctx = getAudioContext();
    polyphone.port.postMessage({type: "cancel"});
    polyphone.parameters.get("nat").cancelScheduledValues(ctx.currentTime);
    polyphone.parameters.get("timbre").cancelScheduledValues(ctx.currentTime);
    polyphone.parameters.get("bias").cancelScheduledValues(ctx.currentTime);
    polyphone.disconnect();
    POLYPHONE_BANK.push(polyphone);
}

function obtainModulator(modulatorFactor=1, carrierFactor=1, differentiated=false, tableDelta=0.02, tables=PROGRAMS.P0) {
    const ctx = getAudioContext();
    let modulator;
    if (MODULATOR_BANK.length) {
        modulator = MODULATOR_BANK.pop();
    } else {
        modulator = new AudioWorkletNode(ctx, "modulator", {numberOfOutputs: 2});
    }
    modulator.parameters.get("timbre").setValueAtTime(0, ctx.currentTime);
    modulator.parameters.get("bias").setValueAtTime(0, ctx.currentTime);
    modulator.port.postMessage({ type: "modulatorFactor", value: modulatorFactor });
    modulator.port.postMessage({ type: "carrierFactor", value: carrierFactor });
    modulator.port.postMessage({ type: "differentiated", value: differentiated });
    modulator.port.postMessage({ type: "tableDelta", value: tableDelta });
    modulator.port.postMessage({ type: "tables", value: tables });

    return modulator;
}

function disposeModulator(modulator) {
    const ctx = getAudioContext();
    modulator.port.postMessage({type: "cancel"});
    modulator.parameters.get("nat").cancelScheduledValues(ctx.currentTime);
    modulator.parameters.get("timbre").cancelScheduledValues(ctx.currentTime);
    modulator.parameters.get("bias").cancelScheduledValues(ctx.currentTime);
    modulator.disconnect();
    MODULATOR_BANK.push(modulator);
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
        new Float32Array([0,  0,  0, 0,  0, 0,  0.0, 0.00, 0.0, 0.00]),
        new Float32Array([0, 10, -2, 2, -2, 1, -0.9, 0.45, 0.1, 0.02])
    )
    PERIODIC_WAVES["warm2"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, -5, 3.33, 2, -1, 0.2, 0.1, -0.02]),
        new Float32Array([0,  0,  0, 0.00, 0,  0, 0.0, 0.0,  0.00]),
    )
    PERIODIC_WAVES["warm3"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, -5, 5, 3, -0.2, 0.1, 0.02]),
        new Float32Array([0,  0,  0, 0, 0,  0.0, 0.0, 0.00])
    )
    PERIODIC_WAVES["warm4"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 2, 2, 1, 0.1, 0.02]),
        new Float32Array([0,  0, 0, 0, 0, 0.0, 0.00])
    )
    PERIODIC_WAVES["octaver"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0,100,-50,0,33,0,0,0,25,0,0,0,0,0,0,0,-16]),
        new Float32Array([0,  0, 0,0, 0,0,0,0, 0,0,0,0,0,0,0,0, 0])
    )
    PERIODIC_WAVES["tritaver"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0,100,0,-50,0,0,0,0,0,33,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-5]),
        new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
    )
    PERIODIC_WAVES["brightness"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 0,0,0 ,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,.00, .0,.0, .0,0.00]),
        new Float32Array([0,10,0,-3,3,-3,3,-3,3,-3,3,-3,3,-1,1,-1,1,-1,.75,-.5,.2,-.1,0.02])
    )
    PERIODIC_WAVES["harmonicbell"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0,  0, 0, 0, 0, 0,0,0,0,0,0,0]),
        new Float32Array([0, 10, -2, 2, 2, 2,0,0,0,0,0,-7])
    )

    // DC-blocked semisine
    const semisineSineComponents = new Float32Array(64);
    const semisineCosineComponents = new Float32Array(64);
    for (let n = 1; n < 64; ++n) {
        semisineCosineComponents[n] = 1 / (1 - 4*n*n);
    }
    PERIODIC_WAVES["semisine"] = AUDIO_CTX.createPeriodicWave(
        semisineCosineComponents,
        semisineSineComponents,
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
        PERIODIC_WAVES["theta" + (index+1)] = AUDIO_CTX.createPeriodicWave(new Float32Array(harmonics), new Float32Array(zeroComponents));

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

class InstrumentBase {
    constructor() {
        const ctx = getAudioContext();
        this._centsToNats = ctx.createGain();
        this._centsToNats.gain.setValueAtTime(Math.log(2)/1200, ctx.currentTime);
        this.pitchBend = ctx.createConstantSource();
        this.pitchBend.start(ctx.currentTime);
        this.pitchBend.connect(this._centsToNats);
        this.detune = this.pitchBend.offset;

        this.vibratoGain = ctx.createGain();
        this.vibratoDepth = this.vibratoGain.gain;
        this.vibratoDepth.setValueAtTime(0, ctx.currentTime);
        this.vibratoOscillator = obtainOscillator();
        this.vibratoOscillator.connect(this.vibratoGain).connect(this._centsToNats);
        this.vibratoFrequency = this.vibratoOscillator.frequency;
        this.vibratoFrequency.setValueAtTime(7, ctx.currentTime);
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

    dispose() {
        disposeOscillator(this.vibratoOscillator);
        this.pitchBend.disconnect();
        this.pitchBend.stop();
    }
}

class MonophonicBase extends InstrumentBase {
    constructor(frequencyGlide=0.001, attack=0.001, release=0.001) {
        super();
        this.frequencyGlide = frequencyGlide;
        this.attack = attack;
        this.release = release;
        const ctx = getAudioContext();
        this.envelope = ctx.createGain();
        this.envelope.gain.setValueAtTime(0, ctx.currentTime);

        this.stack = [];
        this.stackDepletionTime = -10000;

        this.trackPlaying = false;
        this.lastTrackTime = -10000;
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
        super.dispose();
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
        ["waveform", "differentiated", "tableDelta"].forEach(type => {
            this.setConfig({ type, value: data[type] });
        });
    }

    dispose() {
        super.dispose();
        disposeMonophone(this.generator);
    }
}

export class FM extends MonophonicBase {
    constructor(frequencyGlide=0.001, attack=0.001, release=0.001) {
        super(frequencyGlide, attack, release);
        const ctx = getAudioContext();
        this.generator = obtainModulator();
        this.carrier = obtainOscillator();
        this.carrier.frequency.setValueAtTime(0, ctx.currentTime);
        this.generator.connect(this.carrier.frequency, 0);
        this.timbre = this.generator.parameters.get("timbre");
        this.bias = this.generator.parameters.get("bias");
        this._centsToNats.connect(this.generator.parameters.get("nat"));
        this.amplitudeEnvelope = ctx.createGain();
        this.amplitudeEnvelope.gain.setValueAtTime(0, ctx.currentTime);
        this.generator.connect(this.amplitudeEnvelope.gain, 1);
        this.carrier.connect(this.amplitudeEnvelope).connect(this.envelope);
    }

    setFullConfig(data) {
        super.setFullConfig(data);
        ["modulatorFactor", "carrierFactor", "differentiated", "tableDelta"].forEach(type => {
            this.setConfig({ type, value: data[type] });
        });
        setOscillatorWaveform(this.carrier, data.waveform);
    }

    dispose() {
        super.dispose();
        disposeModulator(this.generator);
        disposeOscillator(this.carrier);
        this.amplitudeEnvelope.disconnect();
    }
}

// Max number of concurrent note-ons before things get weird.
// Needs to be a finite number to leave room for releases.
const EXPIRED = 10000;

export class Polyphone extends InstrumentBase {
    constructor(maxPolyphony=12) {
        super();
        this.voiceAges = Array(maxPolyphony).fill(EXPIRED);
        this.generator = obtainPolyphone();
        this.timbre = this.generator.parameters.get("timbre");
        this.bias = this.generator.parameters.get("bias");
        this._centsToNats.connect(this.generator.parameters.get("nat"));
    }

    getOldestIndex() {
        let result = 0;
        this.voiceAges.forEach((age, index) => {
            if (age > this.voiceAges[result]) {
                result = index;
            }
        });
        return result;
    }

    setFullConfig(data) {
        ["waveform", "differentiated", "tableDelta", "attack", "release"].forEach(type => {
            this.setConfig({ type, value: data[type] });
        });
    }

    connect(destination) {
        return this.generator.connect(destination);
    }

    dispose() {
        super.dispose();
        disposePolyphone(this.generator);
    }

    noteOn(frequency, velocity) {
        const nats = Math.log(frequency);
        const ctx = getAudioContext();
        const now = safeNow();
        const id = this.getOldestIndex();
        for (let i = 0; i < this.voiceAges.length; ++i) {
            this.voiceAges[i] += 1;
        }
        this.voiceAges[id] = 0;
        this.setConfig({
            type: "onset",
            when: now,
            id,
            nats,
            velocity,
        });

        function noteOff() {
            const then = safeNow();
            this.setConfig({
                type: "offset",
                when: then,
                id,
            });
            this.voiceAges[id] = EXPIRED;
        }

        return noteOff.bind(this);
    }
}
