<script>
import { WebMidi } from "webmidi";

import Track from "./components/Track.vue";
import { NOTE_OFF, REFERENCE_FREQUENCY, mosMonzoToDiatonic, mosMonzoToSmitonic } from "./util.js";
import { suspendAudio, resumeAudio, playFrequencies, getAudioContext, scheduleAction, Monophone } from "./audio.js";
import { WHITE_MIDDLE_C, midiNumberToWhite } from "./midi.js";

export default {
  components: {
    Track,
  },
  data() {
    return {
      instrument: new Monophone(),
      midiNoteOffCallbacks: new Map(),
      midiInputs: [],
      midiInput: null,
      cancelCallbacks: [],
      mosPattern: "LsLsLsL",
      l: 5,
      s: 2,
      equave: 2,
      baseFrequency: REFERENCE_FREQUENCY,
      beatsPerMinute: 120,
      audioDelay: 0.05,
      playing: false,
      activeRow: null,
      cancelRowCallback: null,
      tracks: [
        {
          instrument: {
            monophonic: true,
            waveform: 'sine',
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
            frequencyGlide: 0.01,
            amplitudeGlide: 0.02,
          },
          cells: [
            null,
            {monzo: [-4, -3], velocity: 0x80},
            null,
            null,
            NOTE_OFF,
            null,
            null,
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
      return this.countL + "L" + this.countS + "s";
    },
    divisions() {
      return this.countL*this.l + this.countS*this.s;
    },
    notation() {
      if (this.mos === "5L2s") {
        return mosMonzoToDiatonic;
      }
      if (this.mos === "4L3s") {
        return mosMonzoToSmitonic;
      }
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
    }
  },
  methods: {
    cellsToFrequencies(cells) {
      let frequency = null;
      let velocity = 0.0;
      const result = cells.map(cell => {
        if (cell === NOTE_OFF) {
          velocity = 0;
        } else if (cell !== null) {
          const step = this.l * cell.monzo[0] + this.s * cell.monzo[1];
          frequency = this.baseFrequency * this.equave ** (step / this.divisions);
          velocity = cell.velocity / 0xFF;
        }
        return {frequency, velocity};
      });
      frequency = this.baseFrequency;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].frequency !== null) {
          frequency = result[i].frequency;
        }
        result[i].frequency = frequency;
      }
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
        if (!this.playing) {
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
    scaleStepToFrequency(step) {
        const equaves = Math.floor(step / this.mosPattern.length);
        step -= equaves * this.mosPattern.length;
        let edoStep = 0;
        for (let i = 0; i < step; ++i) {
          if (this.mosPattern[i] == "L") {
            edoStep += this.l;
          } else {
            edoStep += this.s;
          }
        }
        return this.baseFrequency * this.equave**equaves * this.equave**(edoStep / this.divisions);
    },
    velocityCurve(velocity) {
      return Math.sqrt(velocity) * 0.9 + 0.1;
    },
    arm() {
      if (this.midiInput === null) {
        return;
      }
      resumeAudio();
      function noteOn(e) {
        const white = midiNumberToWhite(e.note.number);
        if (white.number === null) {
          return;
        }
        const frequency = this.scaleStepToFrequency(white.number - WHITE_MIDDLE_C);
        const noteOff = this.instrument.noteOn(frequency, this.velocityCurve(e.note.attack));
        this.midiNoteOffCallbacks.set(e.note.number, noteOff);
      }
      this.midiInput.addListener("noteon", noteOn.bind(this));

      function noteOff(e) {
        if (this.midiNoteOffCallbacks.has(e.note.number)) {
          this.midiNoteOffCallbacks.get(e.note.number)();
          this.midiNoteOffCallbacks.delete(e.note.number);
        }
      }
      this.midiInput.addListener("noteoff", noteOff.bind(this));
    },
  },
  async mounted() {
    await WebMidi.enable();
    this.midiInputs = WebMidi.inputs;
  }
};
</script>

<template>
  <div>
    <button @click="play">play</button>
    <button @click="stop">stop</button>
  </div>
  <div class="break"/>
  <div>
    <Track v-for="cells of cellsWithNotes" :cells="cells" :activeRow="activeRow" />
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
