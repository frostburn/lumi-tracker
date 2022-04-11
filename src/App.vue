<script>
import { WebMidi } from "webmidi";

import Track from "./components/Track.vue";
import DiatonicKeyboard from "./components/DiatonicKeyboard.vue";
import { NOTE_OFF, REFERENCE_FREQUENCY, ratioToCents } from "./util.js";
import { mosMonzoToJ, mosMonzoToDiatonic, mosMonzoToSmitonic } from "./notation.js";
import { suspendAudio, resumeAudio, playFrequencies, getAudioContext, scheduleAction, Monophone } from "./audio.js";
import { WHITE_MIDDLE_C, midiNumberToWhite } from "./midi.js";
import { Keyboard } from "./keyboard.js";

export default {
  components: {
    Track,
    DiatonicKeyboard,
  },
  data() {
    return {
      instrument: new Monophone("oddtheta3"),
      computerKeyboard: null,
      computerNoteOffCallbacks: new Map(),
      midiNoteOffCallbacks: new Map(),
      midiInputs: [],
      midiInput: null,
      activeMidiKeys: new Set(),
      onScreenNoteOffCallback: null,
      cancelCallbacks: [],
      mosPattern: "LsLsLsL",
      l: 5,
      s: 2,
      equave: 2,
      pitchBendMonzo: [1, 0],
      baseFrequency: REFERENCE_FREQUENCY,
      beatsPerMinute: 120,
      audioDelay: 0.05,
      playing: false,
      activeRow: null,
      activeColumn: null,
      inputMode: null,
      inputIndex: null,
      cancelRowCallback: null,
      tracks: [
        {
          instrument: {
            monophonic: true,
            waveform: 'theta2',
            frequencyGlide: 0.01,
            amplitudeGlide: 0.02,
          },
          cells: [
            {monzo: [0, 0], velocity: 0xFF},  // J3
            {monzo: [1, 0], velocity: 0xFF},  // K3
            {monzo: [1, 1], velocity: 0xFF},  // L3
            {monzo: [2, 1], velocity: 0xFF},  // M3
            {monzo: [2, 2], velocity: 0xFF},  // N3
            {monzo: [3, 2], velocity: 0xFF},  // O3
            {monzo: [3, 3], velocity: 0xFF},  // P3
            {monzo: [4, 3], velocity: 0xFF},  // J4
          ],
        },
        {
          instrument: {
            monophonic: true,
            waveform: 'triangle',
            frequencyGlide: 0.05,
            amplitudeGlide: 0.05,
          },
          cells: [
            null,
            {monzo: [-4, -3], velocity: 0x80},
            null,
            null,
            {monzo: [0, 0], velocity: 0x80},
            NOTE_OFF,
            {monzo: [-4, -3], velocity: 0x80},
            null,
          ],
        },
      ]
    }
  },
  computed: {
    countL() {
      let count = 0;
      this.mosPattern.split("").forEach(c => c === "L" ? count++ : null);
      return count;
    },
    countS() {
      let count = 0;
      this.mosPattern.split("").forEach(c => c === "s" ? count++ : null);
      return count;
    },
    mos() {
      return this.countL + "L " + this.countS + "s";
    },
    divisions() {
      return this.countL*this.l + this.countS*this.s;
    },
    natsL() {
      return Math.log(this.equave) * this.l / this.divisions;
    },
    natsS() {
      return Math.log(this.equave) * this.s / this.divisions;
    },
    equaveCents() {
      return ratioToCents(this.equave);
    },
    pitchBendDepth() {
      return (this.l*this.pitchBendMonzo[0] + this.s*this.pitchBendMonzo[1]) / this.divisions * this.equaveCents;
    },
    notation() {
      if (this.mos === "5L 2s") {
        return mosMonzoToDiatonic;
      }
      function notate(monzo) {
        return mosMonzoToJ(this.mos, monzo)
      }
      return notate;
    },
    cellsWithNotes() {
      const result = [];
      this.tracks.forEach(track => {
        result.push(track.cells.map(cell => {
          if (cell === null) {
            return {note: "", velocity: NaN};
          }
          if (cell === NOTE_OFF) {
            return {note: "▭", velocity: NaN};
          }
          return {
            note: this.notation(cell.monzo),
            velocity: cell.velocity
          };
        }));
      });
      return result;
    },
    beatDuration() {
      return 60 / this.beatsPerMinute;
    },
    activeMiniKeys() {
      const result = new Set();
      for (const key of this.activeMidiKeys) {
        result.add((key + 12) % 24);
      }
      return result;
    }
  },
  methods: {
    cellsToFrequencies(cells) {
      let frequency = null;
      let velocity = 0.0;
      const result = cells.map(cell => {
        if (cell === NOTE_OFF) {
          frequency = null;
          velocity = 0;
        } else if (cell !== null) {
          const step = this.l * cell.monzo[0] + this.s * cell.monzo[1];
          frequency = this.baseFrequency * this.equave ** (step / this.divisions);
          velocity = cell.velocity / 0xFF;
        }
        return {frequency, velocity};
      });
      return result;
    },
    cancelPlay() {
      if (this.cancelRowCallback) {
        this.cancelRowCallback();
        this.cancelRowCallback = null;
      }
      while (this.cancelCallbacks.length) {
        this.cancelCallbacks.pop()();
      }
      this.playing = false;
      this.activeRow = null;
    },
    play() {
      this.cancelPlay();
      suspendAudio();
      this.tracks.forEach(track => {
        const cells = this.cellsToFrequencies(track.cells);
        this.cancelCallbacks.push(playFrequencies(cells, track.instrument, this.beatDuration, this.audioDelay));
      });
      this.playing = true;

      const ctx = getAudioContext();
      const startTime = ctx.currentTime;
      function activateNextRow() {
        if (!this.playing || this.activeRow >= this.tracks[0].cells.length) {
          return;
        }
        this.activeRow++;
        const [fire, cancel] = scheduleAction(startTime + this.beatDuration * (this.activeRow + 1), activateNextRow.bind(this));
        this.cancelRowCallback = cancel;
      }
      this.activeRow = -1;
      activateNextRow.bind(this)();

      resumeAudio();
    },
    stop() {
      this.cancelPlay();
      window.setTimeout(suspendAudio, 100);
    },
    selectMidiInput(event) {
      const id = event.target.value;
      this.midiInput = WebMidi.getInputById(id);
    },
    scaleStepToMonzo(step) {
        const equaves = Math.floor(step / this.mosPattern.length);
        step -= equaves * this.mosPattern.length;
        const monzo = [this.countL * equaves, this.countS * equaves];
        for (let i = 0; i < step; ++i) {
          if (this.mosPattern[i] == "L") {
            monzo[0]++;
          } else {
            monzo[1]++;
          }
        }
        return monzo;
    },
    noteOn(monzo, velocity) {
      const frequency = this.baseFrequency * Math.exp(this.natsL * monzo[0] + this.natsS * monzo[1]);
      return this.instrument.noteOn(frequency, velocity);
    },
    velocityCurve(velocity) {
      return Math.sqrt(velocity) * 0.9 + 0.1;
    },
    midiNoteOn(event) {
      const number = event.note.number;
      this.activeMidiKeys.add(number);
      const white = midiNumberToWhite(number);
      if (white.number === null) {
        return;
      }
      const monzo = this.scaleStepToMonzo(white.number - WHITE_MIDDLE_C);
      const noteOff = this.noteOn(monzo, this.velocityCurve(event.note.attack));
      if (this.midiNoteOffCallbacks.has(number)) {
        this.midiNoteOffCallbacks.get(number)();
      }
      this.midiNoteOffCallbacks.set(number, noteOff);
    },
    midiNoteOff(event) {
      const number = event.note.number;
      this.activeMidiKeys.delete(number);
      if (this.midiNoteOffCallbacks.has(number)) {
        this.midiNoteOffCallbacks.get(number)();
        this.midiNoteOffCallbacks.delete(number);
      }
    },
    arm() {
      if (this.midiInput === null) {
        return;
      }
      resumeAudio();
      this.midiInput.addListener("noteon", this.midiNoteOn);
      this.midiInput.addListener("noteoff", this.midiNoteOff);

      function pitchBend(e) {
        const ctx = getAudioContext();
        this.instrument.detune.setTargetAtTime(this.pitchBendDepth * e.value, ctx.currentTime, 0.0001);
      }
      this.midiInput.addListener("pitchbend", pitchBend.bind(this));

      function controlChange(e) {
        const ctx = getAudioContext();
        if (e.subtype === "modulationwheelcoarse") {
          this.instrument.vibratoDepth.setTargetAtTime(100 * e.value, ctx.currentTime, 0.005);
        }
      }
      this.midiInput.addListener("controlchange", controlChange.bind(this));
    },
    onScreenNoteOn(number) {
      resumeAudio();
      const white = midiNumberToWhite(number);
      if (white.number === null) {
        return;
      }
      const monzo = this.scaleStepToMonzo(white.number);
      this.onScreenNoteOffCallback = this.noteOn(monzo, 0.9);
    },
    onMouseUp() {
      if (this.onScreenNoteOffCallback !== null) {
        this.onScreenNoteOffCallback();
        this.onScreenNoteOffCallback = null;
      }
    },
    windowKeydown(event) {
      if (event.code === "Backquote") {
        this.computerKeyboard.deactivate();
      }
    },
    computerKeydown(event) {
      resumeAudio();
      const [x, y, z] = event.coordinates;
      if (z !== 1) {
        return;
      }
      if (y === 1) {
        const monzo = this.scaleStepToMonzo(x + this.mosPattern.length);
        const noteOff = this.noteOn(monzo, 0.9);
        this.computerNoteOffCallbacks.set(event.coordinates, noteOff);
      } else if (y === 3) {
        const monzo = this.scaleStepToMonzo(x + 1);
        const noteOff = this.noteOn(monzo, 0.9);
        this.computerNoteOffCallbacks.set(event.coordinates, noteOff);
      }
    },
    computerKeyup(event) {
      if (this.computerNoteOffCallbacks.has(event.coordinates)) {
        this.computerNoteOffCallbacks.get(event.coordinates)();
      }
    },
    addTrack() {
      this.tracks.push({
        instrument: {
          monophonic: true,
          waveform: 'oddtheta4',
          frequencyGlide: 0.01,
          amplitudeGlide: 0.02,
        },
        cells: [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          {monzo: [8, 6], velocity: 0x80},
        ],
      });
    },
    selectNote(columnIndex, rowIndex) {
      this.activeColumn = columnIndex;
      this.activeRow = rowIndex;
      this.inputMode = "note";
    },
    selectVelocity(columnIndex, rowIndex, inputIndex) {
      this.activeColumn = columnIndex;
      this.activeRow = rowIndex;
      this.inputIndex = inputIndex;
      this.inputMode = "velocity";
    },
    selectNothing() {
      this.activeColumn = null;
      this.inputMode = null;
      this.inputIndex = null;
    }
  },
  async mounted() {
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("click", this.selectNothing);
    this.computerKeyboard = new Keyboard();
    this.computerKeyboard.addEventListener("keydown", this.computerKeydown);
    this.computerKeyboard.addEventListener("keyup", this.computerKeyup);
    window.addEventListener("keydown", this.windowKeydown);
    if (navigator.requestMIDIAccess !== undefined) {
      await WebMidi.enable();
      this.midiInputs = WebMidi.inputs;
    }
  },
  unmounted() {
    this.computerKeyboard.removeEventListener("keydown", this.computerKeydown);
    this.computerKeyboard.removeEventListener("keyup", this.computerKeyup);
    this.computerKeyboard.dispose();
    this.instrument.dispose();
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("click", this.selectNothing);
    if (this.midiInput !== null) {
      this.midiInput.removeListener();
    }
  },
};
</script>

<template>
  <div>
    <button @click="play">play</button>
    <button @click="stop">stop</button>
    <button @click="addTrack">add track</button>
  </div>
  <div class="break"/>
  <div>
    <Track
      v-for="(cells, index) of cellsWithNotes" :cells="cells"
      :key="index"
      :active="index === activeColumn"
      :activeRow="activeRow"
      :inputMode="inputMode"
      :inputIndex="inputIndex"
      @noteClick="(i) => selectNote(index, i)"
      @velocityClick="(i, j) => selectVelocity(index, i, j)"
    />
  </div>
  <div class="break"/>
  <div>
    <h1>MIDI Input</h1>
    <select @change="selectMidiInput">
      <option disabled="disabled" selected="selected" value="">--Select device--</option>
      <option v-for="input of midiInputs" :value="input.id">{{ (input.manufacturer || "(Generic)") + ": " + input.name }}</option>
    </select>
    <div class="break"/>
    <button @click="arm">rec</button>
  </div>
  <div class="break"/>
  <div>
    <DiatonicKeyboard @noteOn="onScreenNoteOn" :activeKeys="activeMiniKeys"/>
  </div>
</template>

<style>
@import "./assets/base.css";

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;

  font-weight: normal;
}

.break {
  clear: both;
}

button {
  float: left;
}

header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

a,
.green {
  text-decoration: none;
  color: hsla(160, 100%, 37%, 1);
  transition: 0.4s;
}

@media (hover: hover) {
  a:hover {
    background-color: hsla(160, 100%, 37%, 0.2);
  }
}

@media (min-width: 1024px) {
  body {
    background: darkgray;
    display: flex;
    place-items: center;
  }

  #app {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0 2rem;
  }

  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  .logo {
    margin: 0 2rem 0 0;
  }
}
</style>
