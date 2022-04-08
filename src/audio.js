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
    return fire;
}

export function playFrequencies(track, delay=0.05) {
    const ctx = getAudioContext();
    const oscillator = obtainOscillator();
    const amplitude = ctx.createGain();
    amplitude.gain.setValueAtTime(0.0, ctx.currentTime);
    oscillator.connect(amplitude).connect(ctx.destination);
    if (track.length) {
        oscillator.frequency.setValueAtTime(track[0].freq, ctx.currentTime);
    }
    let time = ctx.currentTime + delay;
    track.forEach(cell => {
        oscillator.frequency.setTargetAtTime(cell.freq, time, 0.005);
        amplitude.gain.setTargetAtTime(cell.velocity*0.25, time, 0.02);
        time += 0.2;
    });
    amplitude.gain.setTargetAtTime(0.0, time, 0.02);

    const cancel = scheduleAction(time + 0.5, () => {
        disposeOscillator(oscillator);
        amplitude.gain.setValueAtTime(0.0, ctx.currentTime);
        amplitude.disconnect();
    });

    return cancel;
}
