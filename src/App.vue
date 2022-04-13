<script>
import { WebMidi } from "webmidi";
import Track from "./components/Track.vue";
import DiatonicKeyboard from "./components/DiatonicKeyboard.vue";
import { mod, NOTE_OFF, REFERENCE_FREQUENCY, ratioToCents } from "./util.js";
import { mosMonzoToJ, mosMonzoToDiatonic, mosMonzoToSmitonic } from "./notation.js";
import { suspendAudio, resumeAudio, playFrequencies, getAudioContext, scheduleAction, Monophone, setAudioDelay } from "./audio.js";
import { MIDDLE_C, midiNumberToWhite } from "./midi.js";
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
      accidentals: "sharps",
      pitchBendMonzo: [1, 0],
      baseFrequency: REFERENCE_FREQUENCY,
      beatsPerMinute: 200,
      audioDelay: 5,
      playing: false,
      activeRow: null,
      activeColumn: null,
      velocity: 0x80,
      inputMode: null,
      inputIndex: null,
      cancelRowCallback: null,
      tracks: [
        {
          instrument: {
            monophonic: true,
            waveform: 'oddtheta3',
            frequencyGlide: 0.01,
            amplitudeGlide: 0.02,
          },
          cells: Array(24).fill(null),
          /* cells: [
            {monzo: [0, 0], velocity: 0xFF},  // J4
            {monzo: [1, 0], velocity: 0xFF},  // K4
            {monzo: [1, 1], velocity: 0xFF},  // L4
            {monzo: [2, 1], velocity: 0xFF},  // M4
            {monzo: [2, 2], velocity: 0xFF},  // N4
            {monzo: [3, 2], velocity: 0xFF},  // O4
            {monzo: [3, 3], velocity: 0xFF},  // P4
            {monzo: [4, 3], velocity: 0xFF},  // J5
          ],*/
        },
        {
          instrument: {
            monophonic: true,
            waveform: 'triangle',
            frequencyGlide: 0.05,
            amplitudeGlide: 0.05,
          },
          cells: Array(24).fill(null),
        },
      ]
    }
  },
  watch: {
    audioDelay: {
      handler(newValue) {
        setAudioDelay(newValue / 1000);
      },
      immediate: true,
    },
    midiInput(newValue, oldValue) {
      if (oldValue !== null) {
        oldValue.removeListener();
      }
      this.arm();
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
    columnHeight() {
      return this.tracks[0].cells.length;
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
        this.cancelCallbacks.push(playFrequencies(cells, track.instrument, this.beatDuration));
      });
      this.playing = true;

      const ctx = getAudioContext();
      const startTime = ctx.currentTime;
      function activateNextRow() {
        if (!this.playing) {
          return;
        }
        if (!this.incrementRow()) {
          return;
        }
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
      if (velocity === undefined) {
        velocity = this.velocity;
      }
      if (this.inputMode === null) {
        const frequency = this.baseFrequency * Math.exp(this.natsL * monzo[0] + this.natsS * monzo[1]);
        return this.instrument.noteOn(frequency, velocity / 0xFF);
      } else if (this.inputMode === "note" && this.activeRow !== null) {
        if (this.activeRow >= 0 && this.activeRow < this.columnHeight) {
          this.tracks[this.activeColumn].cells[this.activeRow] = { monzo, velocity };
          this.incrementRow();
        }
      }
      return () => {};
    },
    velocityCurve(velocity) {
      return Math.sqrt(velocity) * 0.9 + 0.1;
    },
    midiNumberToMonzo(number) {
      const white = midiNumberToWhite(number);
      let monzo;
      if (white.number === null) {
        if (this.accidentals === "sharps") {
          monzo = this.scaleStepToMonzo(white.sharpOf);
          monzo[0]++;
          monzo[1]--;
        } else if (this.accidentals === "flats") {
          monzo = this.scaleStepToMonzo(white.flatOf);
          monzo[0]--;
          monzo[1]++;
        }
      } else {
        monzo = this.scaleStepToMonzo(white.number);
      }
      return monzo;
    },
    midiNoteOn(event) {
      resumeAudio();
      const number = event.note.number;
      this.activeMidiKeys.add(number);
      const monzo = this.midiNumberToMonzo(number - MIDDLE_C);
      const noteOff = this.noteOn(monzo, event.rawVelocity*2);
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
      const monzo = this.midiNumberToMonzo(number);
      this.onScreenNoteOffCallback = this.noteOn(monzo);
    },
    onMouseUp() {
      if (this.onScreenNoteOffCallback !== null) {
        this.onScreenNoteOffCallback();
        this.onScreenNoteOffCallback = null;
      }
    },
    incrementColumn() {
      if (this.activeColumn >= this.tracks.length - 1) {
        return false;
      }
      this.activeColumn++;
      return true;
    },
    decrementColumn() {
      if (this.activeColumn <= 0) {
        return false;
      }
      this.activeColumn--;
      return true;
    },
    incrementRow(delta=1) {
      if (delta < 0) {
        if (this.activeRow <= 0) {
          return false;
        }
        this.activeRow += delta;
        if (this.activeRow < 0) {
          this.activeRow = 0;
        }
      } else if (delta > 0) {
        if (this.activeRow >= this.columnHeight - 1) {
          return false;
        }
        this.activeRow += delta;
        if (this.activeRow >= this.columnHeight) {
          this.activeRow = this.columnHeight - 1;
        }
      }
      return true;
    },
    windowKeydown(event) {
      if (event.code === "Backquote") {
        this.computerKeyboard.deactivate();
      }
      if (this.activeRow >= 0 && this.activeRow < this.columnHeight) {
        if (this.inputMode === "note") {
          let result;
          let delta = 0;
          if (event.code === "Backquote") {
            result = NOTE_OFF;
            delta = 1;
          } else if (event.key === "Delete") {
            result = null;
          } else if (event.key === "Backspace") {
            result = null;
            delta = -1;
          }
          if (result !== undefined) {
            this.tracks[this.activeColumn].cells[this.activeRow] = result;
            this.incrementRow(delta);
          }
        }
        if (this.inputMode === "velocity") {
          if ("0123456789ABCDEFabcdef".includes(event.key)) {
            const cell = this.tracks[this.activeColumn].cells[this.activeRow];
            if (cell?.velocity === undefined) {
              return;
            }
            const keyValue = parseInt(event.key, 16);
            let value = cell.velocity;
            if (this.inputIndex === 1) {
              value = (value & 0xF0) | keyValue;
            } else if (this.inputIndex === 0) {
              value = (value & 0xF) | (keyValue << 4);
            }
            cell.velocity = value;
            this.incrementRow();
          }
        }
        if (event.key === "ArrowDown") {
          this.incrementRow();
        } else if (event.key === "ArrowUp") {
          this.incrementRow(-1);
        }
        if (event.key === "ArrowRight") {
          if (this.inputMode === "note") {
            this.inputMode = "velocity";
            this.inputIndex = 0;
          } else if (this.inputMode === "velocity") {
            this.inputIndex++;
            if (this.inputIndex > 1) {
              this.inputIndex = 1;
              if (this.incrementColumn()) {
                this.inputMode = "note";
              }
            }
          }
        }
        if (event.key === "ArrowLeft") {
          if (this.inputMode === "note") {
            if (this.decrementColumn()) {
              this.inputMode = "velocity";
              this.inputIndex = 1;
            }
          } else if (this.inputMode === "velocity") {
            this.inputIndex--;
            if (this.inputIndex < 0) {
              this.inputIndex = 0;
              this.inputMode = "note";
            }
          }
        }
      }
    },
    computerKeydown(event) {
      resumeAudio();
      const [x, y, z] = event.coordinates;
      if (z !== 1) {
        return;
      }
      let monzo;
      if (y === 0) {
        const step = x + this.mosPattern.length;
        if (this.mosPattern[mod(step - 1, this.mosPattern.length)] === "L") {
          if (this.accidentals === "sharps") {
            monzo = this.scaleStepToMonzo(step - 1);
            monzo[0]++;
            monzo[1]--;
          } else if (this.accidentals === "flats") {
            monzo = this.scaleStepToMonzo(step);
            monzo[0]--;
            monzo[1]++;
          }
        }
      } else if (y === 1) {
        monzo = this.scaleStepToMonzo(x + this.mosPattern.length);
      } else if (y === 2) {
        const step = x;
        if (this.mosPattern[mod(step, this.mosPattern.length)] === "L") {
          if (this.accidentals === "sharps") {
            monzo = this.scaleStepToMonzo(step);
            monzo[0]++;
            monzo[1]--;
          } else if (this.accidentals === "flats") {
            monzo = this.scaleStepToMonzo(step + 1);
            monzo[0]--;
            monzo[1]++;
          }
        }
      } else if (y === 3) {
        monzo = this.scaleStepToMonzo(x + 1);
      }
      if (monzo !== undefined) {
        const noteOff = this.noteOn(monzo);
        this.computerNoteOffCallbacks.set(event.coordinates, noteOff);
      }
    },
    computerKeyup(event) {
      if (this.computerNoteOffCallbacks.has(event.coordinates)) {
        this.computerNoteOffCallbacks.get(event.coordinates)();
        this.computerNoteOffCallbacks.delete(event.coordinates);
      }
    },
    addTrack() {
      this.tracks.push({
        instrument: {
          monophonic: true,
          waveform: 'theta4',
          frequencyGlide: 0.01,
          amplitudeGlide: 0.02,
        },
        cells: Array(24).fill(null),
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
    <input id="audio-delay" v-model="audioDelay" type="number" min="0" />
    <label for="audio-delay"> audio delay (ms) </label>
  </div>
  <div class="break"/>
  <div>
    <button @click="play">play</button>
    <button @click="stop">stop</button>
    <button @click="addTrack">add track</button>
  </div>
  <div class="break"/>
  <div>
    <label>Accidentals: </label>
    <input type="radio" id="sharps" value="sharps" v-model="accidentals" />
    <label for="sharps">Amps (sharp) </label>

    <input type="radio" id="flats" value="flats" v-model="accidentals" />
    <label for="flats">Ats (flat)</label>
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
  </div>
  <div class="break"/>
  <div>
    <DiatonicKeyboard @noteOn="onScreenNoteOn" :activeKeys="activeMiniKeys"/>
  </div>
  <footer><a href="https://github.com/frostburn/lumi-tracker/issues/">Report bugs and suggest issues</a></footer>
</template>

<style>
@import "./assets/base.css";

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;

  font-weight: normal;
}

footer {
  margin-top: 60px;
}

.break {
  clear: both;
}

input[type=number] {
  width: 5em;
}

button {
  float: left;
}

a,
.green {
  text-decoration: none;
  color: hsla(160, 70%, 17%, 1);
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
    padding: 0 2rem;
  }
}
</style>
