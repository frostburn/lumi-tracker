import { ratioToCents } from "./util.js";

let AUDIO_CTX;
// WebAudio API seems to have a bug where oscillators are not garbage collected.
// Use a banking system to reuse oscillators as much as possible.
const OSCILLATOR_BANK = [];

const DEFAULT_WAVEFORMS = ["sine", "square", "sawtooth", "triangle"];
const PERIODIC_WAVES = {};

export function availableWaveforms() {
    return Object.keys(PERIODIC_WAVES).concat(DEFAULT_WAVEFORMS);
}

export function getAudioContext() {
    if (AUDIO_CTX === undefined) {
        AUDIO_CTX = new AudioContext({latencyHint: "interactive"});
        createWaveforms();
    }
    return AUDIO_CTX;
}

export function suspendAudio() {
    const ctx = getAudioContext();
    ctx.suspend();
}

export function resumeAudio() {
    const ctx = getAudioContext();
    ctx.resume();
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
    if (DEFAULT_WAVEFORMS.includes(waveform)) {
        oscillator.type = waveform;
    } else {
        oscillator.setPeriodicWave(PERIODIC_WAVES[waveform]);
    }
    return oscillator;
}

function disposeOscillator(oscillator) {
    const ctx = getAudioContext();
    oscillator.frequency.cancelScheduledValues(ctx.currentTime);
    oscillator.detune.cancelScheduledValues(ctx.currentTime);
    oscillator.disconnect();
    OSCILLATOR_BANK.push(oscillator);
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
        new Float32Array([0, 10, 2, 2, 2, 1, 1, 0.5, 0.1]),
        new Float32Array([0,  0, 0, 0, 0, 0, 0, 0.0, 0.0])
    )
    PERIODIC_WAVES["warm2"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 5, 3.33, 2, 1, 0.2, 0.1]),
        new Float32Array([0,  0, 0, 0.00, 0, 0, 0.0, 0.0])
    )
    PERIODIC_WAVES["warm3"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 5, 5, 3, 0.2, 0.1]),
        new Float32Array([0,  0, 0, 0, 0, 0.0, 0.0])
    )
    PERIODIC_WAVES["warm4"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 2, 2, 1, 0.1]),
        new Float32Array([0,  0, 0, 0, 0, 0.0])
    )
    PERIODIC_WAVES["octaver"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0,100,50,0,33,0,0,0,25,0,0,0,0,0,0,0,16]),
        new Float32Array([0,  0, 0,0, 0,0,0,0, 0,0,0,0,0,0,0,0, 0])
    )
    PERIODIC_WAVES["brightness"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0,10,0,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,.75,.5,.2,.1]),
        new Float32Array([0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,.00,.0,.0,.0])
    )
    PERIODIC_WAVES["harmonicbell"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 10, 2, 2, 2, 2,0,0,0,0,0,7]),
        new Float32Array([0,  0, 0, 0, 0, 0,0,0,0,0,0,0])
    )
    PERIODIC_WAVES["semisine"] = AUDIO_CTX.createPeriodicWave(
        new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        new Float32Array([0, 1, 0.25, 0.111111, 0.0625, 0.04, 0.027777, 0.020408, 0.015625, 0.0123456, 0.01, 0.008264, 0.0069444, 0.0059171, 0.005102041, 0.0044444, 0.00390625])
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

export function playFrequencies(cells, instrument, beatDuration, delay) {
    const ctx = getAudioContext();
    const oscillator = obtainOscillator(instrument.waveform);
    oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
    const amplitude = ctx.createGain();
    amplitude.gain.setValueAtTime(0.0, ctx.currentTime);
    oscillator.connect(amplitude).connect(ctx.destination);
    let lastFrequency = null;
    let time = ctx.currentTime + delay;
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
        amplitude.gain.setTargetAtTime(cell.velocity*0.25, time, instrument.amplitudeGlide);
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

export class Monophone {
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
        this.oscillator.connect(this.envelope).connect(ctx.destination);

        this.vibratoGain = ctx.createGain();
        this.vibratoDepth = this.vibratoGain.gain;
        this.vibratoDepth.setValueAtTime(0, ctx.currentTime);
        this.vibratoOscillator = obtainOscillator();
        this.vibratoOscillator.connect(this.vibratoGain).connect(this.oscillator.detune);
        this.vibratoFrequency = this.vibratoOscillator.frequency;
        this.vibratoFrequency.setValueAtTime(7, ctx.currentTime);

        this.stack = [];
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
        const now = ctx.currentTime;
        this.envelope.gain.cancelScheduledValues(now);
        this.envelope.gain.setTargetAtTime(0.5*velocity, now, this.amplitudeGlide);
        if (this.stack.length) {
            this.oscillator.detune.setTargetAtTime(cents, now, this.frequencyGlide);
        } else {
            this.oscillator.detune.setValueAtTime(cents, now);
        }
        const id = Symbol();
        const voice = {cents, velocity, id};
        this.stack.push(voice);

        function noteOff() {
            const then = ctx.currentTime;
            if (!this.stack.length) {
                console.log("Warning: Note off with an empty stack");
                this.envelope.gain.setTargetAtTime(0, then, this.amplitudeGlide);
            }
            if (this.stack[this.stack.length - 1].id === id) {
                this.stack.pop();
                if (!this.stack.length) {
                    this.envelope.gain.setTargetAtTime(0, then, this.amplitudeGlide);
                    return;
                }
                const topVoice = this.stack[this.stack.length - 1];
                this.oscillator.detune.setTargetAtTime(topVoice.cents, then, this.frequencyGlide);
                this.envelope.gain.setTargetAtTime(0.5*topVoice.velocity, then, this.amplitudeGlide);
            } else {
                this.stack.splice(this.stack.indexOf(voice), 1);
            }
        }

        return noteOff.bind(this);
    }
}
