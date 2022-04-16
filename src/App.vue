<script>
import { WebMidi } from "webmidi";
import TrackRowLabels from "./components/TrackRowLabels.vue";
import Track from "./components/Track.vue";
import DiatonicKeyboard from "./components/DiatonicKeyboard.vue";
import ComputerKeyboard from "./components/ComputerKeyboard.vue";
import MosModal from "./components/MosModal.vue";
import InstrumentModal from "./components/InstrumentModal.vue";
import { mod, NOTE_OFF, REFERENCE_FREQUENCY, REFERENCE_OCTAVE, ratioToCents } from "./util.js";
import { mosMonzoToJ, mosMonzoToDiatonic, mosMonzoToSmitonic } from "./notation.js";
import { suspendAudio, resumeAudio, playFrequencies, getAudioContext, scheduleAction, setAudioDelay } from "./audio.js";
import { Monophone, availableWaveforms, setWaveform } from "./audio.js";
import { MIDDLE_C, midiNumberToWhite } from "./midi.js";
import { Keyboard } from "./keyboard.js";

const COLUMN_HEIGHT = 64;

export default {
  components: {
    MosModal,
    InstrumentModal,
    TrackRowLabels,
    Track,
    DiatonicKeyboard,
    ComputerKeyboard,
  },
  data() {
    return {
      instrument: new Monophone("oddtheta3", 0.01, 0.02),
      activeInstrument: null,
      computerKeyboard: null,
      computerNoteOffCallbacks: new Map(),
      activeComputerKeys: new Set(),
      midiNoteOffCallbacks: new Map(),
      midiInputs: [],
      midiInput: null,
      activeMidiKeys: new Set(),
      onScreenNoteOffCallback: null,
      cancelCallbacks: [],
      showMosModal: false,
      showInstrumentModal: false,
      mosPattern: "LLsLLLs",
      l: 2,
      s: 1,
      equave: 2,
      accidentals: "sharps",
      pitchBendMonzo: [1, 0],
      baseFrequency: REFERENCE_FREQUENCY,
      beatsPerMinute: 480,
      audioDelay: 5,
      playing: false,
      activeRow: null,
      activeColumn: null,
      activeFrame: 0,
      octave: REFERENCE_OCTAVE,
      velocity: 0x80,
      inputMode: null,
      inputIndex: null,
      cancelRowCallback: null,
      frames: [[0, 0], [1, 1]],
      tracks: [
        {
          instrument: {
            monophonic: true,
            waveform: 'oddtheta3',
            frequencyGlide: 10,
            amplitudeGlide: 20,
          },
          patterns: [
            Array(COLUMN_HEIGHT).fill(null),
            Array(COLUMN_HEIGHT).fill(null),
          ],
        },
        {
          instrument: {
            monophonic: true,
            waveform: 'triangle',
            frequencyGlide: 50,
            amplitudeGlide: 50,
          },
          patterns: [
            Array(COLUMN_HEIGHT).fill(null),
            Array(COLUMN_HEIGHT).fill(null),
          ],
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
    },
    activeInstrument: {
      handler(newValue) {
        setWaveform(this.instrument.oscillator, this.activeInstrument.waveform);
        this.instrument.frequencyGlide = this.activeInstrument.frequencyGlide / 1000;
        this.instrument.amplitudeGlide = this.activeInstrument.amplitudeGlide / 1000;
      },
      deep: true,
    },
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
    sharpsStr() {
      if (this.mos === "5L 2s") {
        return "Sharps";
      }
      return "Amps (sharp)";
    },
    flatsStr() {
      if (this.mos === "5L 2s") {
        return "Flats";
      }
      return "Ats (flat)";
    },
    cellsWithNotes() {
      const result = [];
      this.tracks.forEach((track, i) => {
        const cells = track.patterns[this.frames[this.activeFrame][i]];
        result.push(cells.map(cell => {
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
    activeCells() {
      return this.tracks[this.activeColumn].patterns[this.frames[this.activeFrame][this.activeColumn]];
    },
    columnHeight() {
      return this.tracks[0].patterns[this.frames[this.activeFrame][0]].length;
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
    },
    waveforms() {
      return availableWaveforms();
    },
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
    scrollIntoView() {
      // TODO: Scroll into view on note input
      this.$nextTick().then(() => {
        const trackComponent = this.$refs.tracks[this.activeColumn || 0];
        trackComponent.scrollIntoView();
      });
    },
    play(extent) {
      this.cancelPlay();
      suspendAudio();
      this.tracks.forEach((track, i) => {
        const cells = [];
        if (extent === "frame") {
          const activeCells = this.cellsToFrequencies(track.patterns[this.frames[this.activeFrame][i]]);
          Array.prototype.push.apply(cells, activeCells);
        } else if (extent === "song") {
          this.frames.forEach(frame => {
            const frameCells = this.cellsToFrequencies(track.patterns[frame[i]]);
            Array.prototype.push.apply(cells, frameCells);
          });
        }
        const instrument = {
          waveform: track.instrument.waveform,
          frequencyGlide: track.instrument.frequencyGlide / 1000,
          amplitudeGlide: track.instrument.amplitudeGlide / 1000,
        };
        this.cancelCallbacks.push(playFrequencies(cells, instrument, this.beatDuration));
      });
      this.playing = true;

      const ctx = getAudioContext();
      const startTime = ctx.currentTime;
      const beatDuration = this.beatDuration;
      let index = 0;
      function activateNextRow() {
        if (!this.playing) {
          return;
        }
        if (extent === "song"){
          if (!this.incrementRowOrFrame()) {
            return;
          }
        } else {
          if (!this.incrementRow()) {
            return;
          }
        }
        this.scrollIntoView();
        index++;
        const [fire, cancel] = scheduleAction(startTime + beatDuration * index, activateNextRow.bind(this));
        this.cancelRowCallback = cancel;
      }
      this.activeRow = -1;
      if (extent === "song") {
        this.activeFrame = 0;
      }
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
      if (this.divisions === 0) {
        return () => {};
      }
      if (velocity === undefined) {
        velocity = this.velocity;
      }
      const octave = this.octave - REFERENCE_OCTAVE;
      monzo[0] += this.countL * octave;
      monzo[1] += this.countS * octave;
      if (this.inputMode === null) {
        const frequency = this.baseFrequency * Math.exp(this.natsL * monzo[0] + this.natsS * monzo[1]);
        return this.instrument.noteOn(frequency, velocity / 0xFF);
      } else if (this.inputMode === "note" && this.activeRow !== null) {
        if (this.activeRow >= 0 && this.activeRow < this.columnHeight) {
          this.activeCells[this.activeRow] = { monzo, velocity };
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
    onScreenComputerNoteOn(code) {
      /* TODO */
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
    incrementRowOrFrame() {
      if (this.activeRow >= this.columnHeight - 1) {
        if (this.activeFrame >= this.frames.length - 1) {
          return false;
        }
        this.activeRow = 0;
        this.activeFrame++;
      } else {
        this.activeRow++;
      }
      return true;
    },
    ignoreKeydown(event) {
      if (event?.target instanceof HTMLInputElement && event?.target?.type !== "range") {
        return true;
      } else if (event?.target instanceof HTMLSelectElement) {
        return true;
      }
      return false;
    },
    windowKeydown(event) {
      if (this.ignoreKeydown(event)) {
        return;
      }
      if (event.code === "Backquote") {
        this.computerKeyboard.deactivate();
        this.activeComputerKeys.add(event.code);
      }
      if (["ShiftLeft", "ShiftRight"].includes(event.code)) {
        this.activeComputerKeys.add(event.code);
      }
      if (event.code === "NumpadDivide") {
        this.octave--;
      }
      if (event.code === "NumpadMultiply") {
        this.octave++;
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
            delta = 1;
          } else if (event.key === "Backspace") {
            result = null;
            delta = -1;
          }
          if (result !== undefined) {
            this.activeCells[this.activeRow] = result;
            this.incrementRow(delta);
          }
        }
        if (this.inputMode === "velocity") {
          if ("0123456789ABCDEFabcdef".includes(event.key)) {
            const cell = this.activeCells[this.activeRow];
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
        if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) {
          event.preventDefault();
          this.scrollIntoView();
        }
      }
    },
    windowKeyup(event) {
      if (["Backquote", "ShiftLeft", "ShiftRight"].includes(event.code)) {
        this.activeComputerKeys.delete(event.code);
      }
    },
    computerKeydown(event) {
      if (this.ignoreKeydown(event)) {
        return;
      }
      if (event.code === "Backquote") {
        return;
      }
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
        this.activeComputerKeys.add(event.code);
        const noteOff = this.noteOn(monzo);
        this.computerNoteOffCallbacks.set(event.coordinates, noteOff);
      }
    },
    computerKeyup(event) {
      if (this.computerNoteOffCallbacks.has(event.coordinates)) {
        this.computerNoteOffCallbacks.get(event.coordinates)();
        this.computerNoteOffCallbacks.delete(event.coordinates);
      }
      this.activeComputerKeys.delete(event.code);
    },
    addTrack() {
      this.tracks.push({
        instrument: {
          monophonic: true,
          waveform: 'theta4',
          frequencyGlide: 10,
          amplitudeGlide: 20,
        },
        patterns: [
          Array(this.tracks[0].patterns[0].length).fill(null),
          Array(this.tracks[0].patterns[1].length).fill(null),
        ],
      });
      this.frames.forEach((frame, i) => frame.push(i));
    },
    addFrame() {
      this.tracks.forEach(track => {
        track.patterns.push(Array(this.columnHeight).fill(null));
      });
      const newPattern = this.frames.length;
      this.frames.push(Array(this.tracks.length).fill(newPattern));
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
    },
    choosePattern(pattern) {
      this.mosPattern = pattern;
      this.showMosModal = false;
    },
    openInstrumentModal(instrument) {
      this.activeInstrument = instrument;
      this.showInstrumentModal = true;
    }
  },
  async mounted() {
    this.activeInstrument = this.tracks[0].instrument;
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("click", this.selectNothing);
    this.computerKeyboard = new Keyboard();
    this.computerKeyboard.addEventListener("keydown", this.computerKeydown);
    this.computerKeyboard.addEventListener("keyup", this.computerKeyup);
    window.addEventListener("keydown", this.windowKeydown);
    window.addEventListener("keyup", this.windowKeyup);
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
    window.removeEventListener("keydown", this.windowKeydown);
    window.removeEventListener("keyup", this.windowKeyup);
    if (this.midiInput !== null) {
      this.midiInput.removeListener();
    }
  },
};
</script>

<template>
  <Teleport to="body">
    <MosModal :show="showMosModal" @close="showMosModal = false" @selectPattern="choosePattern" />
  </Teleport>

  <Teleport to="body">
    <InstrumentModal :show="showInstrumentModal" @close="showInstrumentModal = false" :instrument="activeInstrument" />
  </Teleport>

  <div>
    <label for="audio-delay">Audio delay (ms): </label>
    <input id="audio-delay" v-model="audioDelay" type="number" min="0" />

    <label for="tempo"> BPM: </label>
    <input id="tempo" v-model="beatsPerMinute" type="number" min="1" />

    <button id="select-mos" @click="showMosModal = true">select MOS</button>
    <label for="select-mos"> = {{ mosPattern }}</label>
  </div>
  <div class="break" />
  <div>
    <label for="l">L=</label>
    <input id="l" v-model="l" type="number">
    <label for="s"> s=</label>
    <input id="s" v-model="s" type="number">
    <label for="equave"> = {{divisions}}ed</label>
    <input id="equave" v-model="equave" type="number" step="0.01">
    <label for="frame"> Frame: </label>
    <input id="frame" v-model="activeFrame" type="number" min="0" :max="frames.length - 1" />
    <button @click="addFrame">add frame</button>
  </div>
  <div class="break"/>
  <div>
    <button @click="play('song')">play song</button>
    <button @click="play('frame')">play frame</button>
    <button @click="stop">stop</button>
    <button @click="addTrack">add track</button>

    <label for="octave"> Octave: </label>
    <input id="octave" type="number" v-model="octave" />

    <label> Accidentals: </label>
    <input type="radio" id="sharps" value="sharps" v-model="accidentals" />
    <label for="sharps">{{ sharpsStr }} </label>

    <input type="radio" id="flats" value="flats" v-model="accidentals" />
    <label for="flats">{{ flatsStr }}</label>
  </div>
  <div class="break"/>
  <table>
    <tr>
      <th v-for="track of tracks">
        <select v-model="track.instrument.waveform" @focus="activeInstrument = track.instrument">
          <option v-for="waveform of waveforms">{{ waveform }}</option>
        </select>
        <span class="instrument-config" @click="openInstrumentModal(track.instrument)">⚙</span>
      </th>
    </tr>
  </table>
  <div class="track-container">
    <TrackRowLabels :numRows="columnHeight" @click="(i) => activeRow = i"/>
    <Track
      v-for="(cells, index) of cellsWithNotes" :cells="cells"
      :key="index"
      ref="tracks"
      :active="index === activeColumn"
      :activeRow="activeRow"
      :inputMode="inputMode"
      :inputIndex="inputIndex"
      @noteClick="(i) => selectNote(index, i)"
      @velocityClick="(i, j) => selectVelocity(index, i, j)"
    />
  </div>
  <div class="break"/>
  <div class="input-container">
    <div class="input-column">
      <h1>MIDI Input</h1>
      <select @change="selectMidiInput">
        <option disabled="disabled" selected="selected" value="">--Select device--</option>
        <option v-for="input of midiInputs" :value="input.id">{{ (input.manufacturer || "(Generic)") + ": " + input.name }}</option>
      </select>
      <div class="break"/>
      <div>
        <DiatonicKeyboard @noteOn="onScreenNoteOn" :activeKeys="activeMiniKeys"/>
      </div>
    </div>
    <div class="input-column">
      <h1>Computer Keyboard Input</h1>
      <ComputerKeyboard @noteOn="onScreenComputerNoteOn" :activeKeys="activeComputerKeys" />
    </div>
  </div>
  <div class="break"/>
  <footer><a href="https://github.com/frostburn/lumi-tracker/issues/">Report bugs and suggest issues</a></footer>
</template>

<style>
@import "./assets/base.css";

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;

  font-weight: normal;
}

.track-container {
  display: flex;
  width: 700px;
  height: 700px;
  overflow: scroll;
}

.input-column {
  float: left;
  margin-right: 20px;
}

.instrument-config {
  cursor: pointer;
}

h1 {
  font-size: 1.2em;
}

footer {
  margin-top: 10px;
}

.break {
  clear: both;
}

input[type=number] {
  width: 5em;
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

body {
  background: darkgray;
  display: flex;
  place-items: center;
}
</style>
