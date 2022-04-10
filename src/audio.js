let AUDIO_CTX;
// WebAudio API seems to have a bug where oscillators are not garbage collected.
// Use a banking system to reuse oscillators as much as possible.
const OSCILLATOR_BANK = [];

export function getAudioContext() {
    if (AUDIO_CTX === undefined) {
        AUDIO_CTX = new AudioContext({latencyHint: "interactive"});
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

function obtainOscillator() {
    if (OSCILLATOR_BANK.length) {
        return OSCILLATOR_BANK.pop();
    }
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    oscillator.start(ctx.currentTime);
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

export function playFrequencies(cells, instrument, beatDuration, delay) {
    const ctx = getAudioContext();
    const oscillator = obtainOscillator();
    oscillator.type = instrument.waveform;
    const amplitude = ctx.createGain();
    amplitude.gain.setValueAtTime(0.0, ctx.currentTime);
    oscillator.connect(amplitude).connect(ctx.destination);
    if (cells.length) {
        oscillator.frequency.setValueAtTime(cells[0].frequency, ctx.currentTime);
    }
    let time = ctx.currentTime + delay;
    cells.forEach(cell => {
        oscillator.frequency.setTargetAtTime(cell.frequency, time, instrument.frequencyGlide);
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
    constructor(frequencyGlide=0.009, amplitudeGlide=0.005) {
        this.frequencyGlide = frequencyGlide;
        this.amplitudeGlide = amplitudeGlide;
        const ctx = getAudioContext();
        this.oscillator = obtainOscillator();
        this.oscillator.type = "triangle";
        this.detune = this.oscillator.detune;
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
    }

    noteOn(frequency, velocity) {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        this.envelope.gain.cancelScheduledValues(now);
        this.envelope.gain.setTargetAtTime(0.5*velocity, now, this.amplitudeGlide);
        if (this.stack.length) {
            this.oscillator.frequency.setTargetAtTime(frequency, now, this.frequencyGlide);
        } else {
            this.oscillator.frequency.setValueAtTime(frequency, now);
        }
        const id = Symbol();
        const voice = {frequency, velocity, id};
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
                this.oscillator.frequency.setTargetAtTime(topVoice.frequency, then, this.frequencyGlide);
                this.envelope.gain.setTargetAtTime(0.5*topVoice.velocity, then, this.amplitudeGlide);
            } else {
                this.stack.splice(this.stack.indexOf(voice), 1);
            }
        }

        return noteOff.bind(this);
    }
}
