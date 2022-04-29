<script>
import { WebMidi } from "webmidi";
import TrackRowLabels from "./components/TrackRowLabels.vue";
import Track from "./components/Track.vue";
import DiatonicKeyboard from "./components/DiatonicKeyboard.vue";
import ComputerKeyboard from "./components/ComputerKeyboard.vue";
import MosModal from "./components/MosModal.vue";
import EdoModal from "./components/EdoModal.vue";
import InstrumentModal from "./components/InstrumentModal.vue";
import TimeDomainVisualizer from "./components/TimeDomainVisualizer.vue";
import { mod, NOTE_OFF, REFERENCE_FREQUENCY, REFERENCE_OCTAVE, ratioToCents, unicodeLength, unicodeSplit } from "./util.js";
import { mosMonzoToJ, mosMonzoToDiatonic, mosMonzoToSmitonic } from "./notation.js";
import { suspendAudio, resumeAudio, playFrequencies, getAudioContext, scheduleAction, setAudioDelay, safeNow } from "./audio.js";
import { Monophone, availableWaveforms, loadAudioWorklets, Noise, availableNoiseModels } from "./audio.js";
import { MIDDLE_C, midiNumberToWhite } from "./midi.js";
import { Keyboard } from "./keyboard.js";
import PROGRAMS from "./presets/programs.js";

const DEFAULT_COLUMN_HEIGHT = 64;
const CONTROL_TIME = 0.005;

export default {
  components: {
    MosModal,
    EdoModal,
    InstrumentModal,
    TrackRowLabels,
    Track,
    DiatonicKeyboard,
    ComputerKeyboard,
    TimeDomainVisualizer,
  },
  data() {
    return {
      globalGain: null,  // Initialized on mounting for convenience
      monophone: null,  // Can only be initialized on mounting
      noise: null,  // same
      analyser: null,
      activeInstrument: null,
      activeProgram: "P0",
      computerKeyboard: null,
      computerNoteOffCallbacks: new Map(),
      activeComputerKeys: new Set(),
      midiNoteOffCallbacks: new Map(),
      midiInputs: [],
      midiInput: null,
      midiUseOctave: false,
      activeMidiKeys: new Set(),
      onScreenNoteOffCallback: null,
      cancelCallbacks: [],
      showMosModal: false,
      showEdoModal: false,
      showInstrumentModal: false,
      accidentals: "sharps",
      pitchBendMonzo: [1, 0],
      controls: {
        timbre: 0,
        bias: 0,
        vibratoDepth: 0,
        vibratoFrequency: 7,
      },
      audioDelay: 1,
      playing: false,
      activeRow: null,
      activeColumn: null,
      activeFrameIndex: 0,
      octave: REFERENCE_OCTAVE,
      velocity: 0x80,
      inputMode: null,
      inputIndex: null,
      cancelRowCallback: null,
      selectActive: false,
      selectStart: null,
      selectStop: null,
      copied: null,
      song: {
        highlightPeriod: 4,
        baseFrequency: REFERENCE_FREQUENCY,
        beatsPerMinute: 480,
        mosPattern: "LLsLLLs",
        l: 2,
        s: 1,
        equave: 2,
        frames: [[0, 0]],
        columnHeight: DEFAULT_COLUMN_HEIGHT,
        tracks: [
          {
            instrument: {
              type: 'monophone',
              waveform: 'pulse',
              frequencyGlide: 5,
              attack: 10,
              release: 20,
              tableDelta: 20,
            },
            patterns: [
              Array(DEFAULT_COLUMN_HEIGHT).fill(null),
            ],
          },
          {
            instrument: {
              type: 'noise',
              frequencyGlide: 1,
              attack: 1,
              release: 2,
              model: 'uniform',
              jitterModel: 'balanced',
              jitterType: 'pulseWidth',
              bitDepth: 1,
              finiteLength: 8,
              finiteSeed: 0,
              jitterBitDepth: 1,
              jitterFiniteLength: 8,
              jitterFiniteSeed: 0,
              jitterLogisticR: 4,
              diffStages: 0,
              linear: false,
              underSampling: 1,
              tableDelta: 20,
            },
            patterns: [
              Array(DEFAULT_COLUMN_HEIGHT).fill(null),
            ],
          },
        ]
      },
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
        if (newValue.type === 'monophone') {
          this.configureInstrument(this.monophone, newValue);
        } else if (newValue.type === "noise") {
          this.configureInstrument(this.noise, newValue);
        }
      },
      deep: true,
    },
    activeProgram(newValue) {
      if (newValue in PROGRAMS) {
        this.monophone.setProgram(PROGRAMS[newValue]);
        this.noise.setProgram(PROGRAMS[newValue]);
      }
    },
    'song.columnHeight': {
      handler(newValue) {
        if (newValue < 1) {
          this.song.columnHeight = 1;
          return;
        }
        if (newValue > 256) {
          this.song.columnHeight = 256;
          return;
        }
        this.song.tracks.forEach(track => {
          track.patterns.forEach(pattern => {
            while (pattern.length < newValue) {
              pattern.push(null);
            }
          });
        });
      },
    },
    'controls.timbre': {
      handler(newValue) {
        if (this.noise !== null) {
          this.noise.timbre.setTargetAtTime(newValue, safeNow(), CONTROL_TIME);
        }
        if (this.monophone !== null) {
          this.monophone.timbre.setTargetAtTime(newValue, safeNow(), CONTROL_TIME);
        }
      }
    },
    'controls.bias': {
      handler(newValue) {
        if (this.noise !== null) {
          this.noise.jitter.setTargetAtTime(newValue, safeNow(), CONTROL_TIME);
        }
        if (this.monophone !== null) {
          this.monophone.bias.setTargetAtTime(newValue, safeNow(), CONTROL_TIME);
        }
      }
    },
    'controls.vibratoDepth': {
      handler(newValue) {
        if (this.noise !== null) {
          this.noise.vibratoDepth.setTargetAtTime(newValue, safeNow(), CONTROL_TIME);
        }
        if (this.monophone !== null) {
          this.monophone.vibratoDepth.setTargetAtTime(newValue, safeNow(), CONTROL_TIME);
        }
      }
    },
    'controls.vibratoFrequency': {
      handler(newValue) {
        if (this.noise !== null) {
          this.noise.vibratoFrequency.setTargetAtTime(newValue, safeNow(), CONTROL_TIME);
        }
        if (this.monophone !== null) {
          this.monophone.vibratoFrequency.setTargetAtTime(newValue, safeNow(), CONTROL_TIME);
        }
      }
    },
  },
  computed: {
    countL() {
      let count = 0;
      this.song.mosPattern.split("").forEach(c => c === "L" ? count++ : null);
      return count;
    },
    countS() {
      let count = 0;
      this.song.mosPattern.split("").forEach(c => c === "s" ? count++ : null);
      return count;
    },
    mosSize() {
      return this.song.mosPattern.length;
    },
    mos() {
      return this.countL + "L " + this.countS + "s";
    },
    divisions() {
      return this.countL*this.song.l + this.countS*this.song.s;
    },
    natsL() {
      return Math.log(this.song.equave) * this.song.l / this.divisions;
    },
    natsS() {
      return Math.log(this.song.equave) * this.song.s / this.divisions;
    },
    equaveCents() {
      return ratioToCents(this.song.equave);
    },
    pitchBendDepth() {
      return (this.song.l*this.pitchBendMonzo[0] + this.song.s*this.pitchBendMonzo[1]) / this.divisions * this.equaveCents;
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
    activeFrame() {
      return this.song.frames[this.activeFrameIndex];
    },
    cellsWithNotes() {
      const result = [];
      this.song.tracks.forEach((track, i) => {
        const cells = track.patterns[this.activeFrame[i]].slice(0, this.song.columnHeight);
        result.push(cells.map(cell => {
          if (cell === null) {
            return {note: "", velocity: NaN};
          }
          if (cell === NOTE_OFF) {
            return {note: "▭", velocity: NaN};
          }
          return {
            note: this.notation(cell.monzo),
            velocity: cell.velocity,
            program: cell.program,
          };
        }));
      });
      return result;
    },
    activeCells() {
      return this.song.tracks[this.activeColumn].patterns[this.activeFrame[this.activeColumn]];
    },
    beatDuration() {
      return 60 / this.song.beatsPerMinute;
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
    noiseModels() {
      return availableNoiseModels();
    },
    selection() {
      if (this.selectStart === null || this.selectStop === null) {
        return undefined;
      }
      return {
        left: Math.min(this.selectStart.columnIndex, this.selectStop.columnIndex),
        right: Math.max(this.selectStart.columnIndex, this.selectStop.columnIndex),
        top: Math.min(this.selectStart.rowIndex, this.selectStop.rowIndex),
        bottom: Math.max(this.selectStart.rowIndex, this.selectStop.rowIndex),
      };
    },
  },
  methods: {
    cellFrequency(cell) {
      const step = this.song.l * cell.monzo[0] + this.song.s * cell.monzo[1];
      return this.song.baseFrequency * this.song.equave ** (step / this.divisions);
    },
    cellsToFrequencies(cells) {
      let frequency = null;
      let velocity = 0.0;
      const result = cells.map(cell => {
        if (cell === NOTE_OFF) {
          frequency = null;
          velocity = 0;
        } else if (cell !== null) {
          frequency = this.cellFrequency(cell);
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
    scrollIntoView(columnIndex, rowIndex, options) {
      if (columnIndex === undefined) {
        columnIndex = this.activeColumn || 0;
      }
      if (rowIndex === undefined) {
        rowIndex = this.activeRow || 0;
      }
      if (options === undefined) {
        options = {
          behavior: "auto",
          block: "nearest",
          inline: "nearest",
        };
      }
      this.$nextTick().then(() => {
        const trackComponent = this.$refs.tracks[columnIndex];
        trackComponent.scrollIntoView(rowIndex, options);
      });
    },
    configureInstrument(instrument, spec) {
      if (instrument === null) {
        return;
      }
      const data = {};
      Object.assign(data, spec);
      data.frequencyGlide /= 1000;
      data.attack /= 1000;
      data.release /= 1000;
      data.tableDelta /= 1000;
      instrument.setFullConfig(data);
    },
    play(extent) {
      this.cancelPlay();
      suspendAudio();
      const now = safeNow();
      this.song.tracks.forEach((track, i) => {
        let cells = [];
        if (extent === "frame") {
          cells = track.patterns[this.activeFrame[i]].slice(0, this.song.columnHeight);
        } else if (extent === "song") {
          this.song.frames.forEach(frame => {
            cells = cells.concat(track.patterns[frame[i]].slice(0, this.song.columnHeight));
          });
        }
        let instrument;
        if (track.instrument.type === "noise") {
          instrument = new Noise();
        } else if (track.instrument.type === "monophone") {
          instrument = new Monophone();
        }
        this.configureInstrument(instrument, track.instrument);
        instrument.connect(this.globalGain);

        let currentProgram = null;
        let time = now;
        cells.forEach(cell => {
          if (cell === NOTE_OFF) {
            instrument.trackNoteOff(time);
          } else if (cell !== null) {
            instrument.trackNoteOn(this.cellFrequency(cell), cell.velocity / 0xFF, time);
            if (cell.program !== currentProgram) {
              currentProgram = cell.program;
              instrument.setProgram(PROGRAMS[currentProgram], time);
            }
          }
          time += this.beatDuration;
        });
        instrument.trackNoteOff(time);

        this.cancelCallbacks.push(instrument.dispose.bind(instrument));
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
        this.scrollIntoView(undefined, undefined, {
          behavior: "auto",
          block: "center",
          inline: "center",
        });
        index++;
        const [fire, cancel] = scheduleAction(startTime + beatDuration * index, activateNextRow.bind(this));
        this.cancelRowCallback = cancel;
      }
      this.activeRow = -1;
      if (extent === "song") {
        this.activeFrameIndex = 0;
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
        const equaves = Math.floor(step / this.mosSize);
        step -= equaves * this.mosSize;
        const monzo = [this.countL * equaves, this.countS * equaves];
        for (let i = 0; i < step; ++i) {
          if (this.song.mosPattern[i] == "L") {
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
        const frequency = this.song.baseFrequency * Math.exp(this.natsL * monzo[0] + this.natsS * monzo[1]);
        if (this.activeInstrument.type === "monophone") {
          return this.monophone.noteOn(frequency, velocity / 0xFF);
        } else if (this.activeInstrument.type === "noise") {
          return this.noise.noteOn(frequency, velocity / 0xFF);
        }
      } else if (this.inputMode === "note" && this.activeRow !== null) {
        if (this.activeRow >= 0 && this.activeRow < this.song.columnHeight) {
          this.activeCells[this.activeRow] = { monzo, velocity, program: this.activeProgram };
          this.incrementRow();
          this.scrollIntoView();
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
      if (!this.midiUseOctave) {
        const octave = this.octave - REFERENCE_OCTAVE;
        monzo[0] -= this.countL * octave;
        monzo[1] -= this.countS * octave;
      }
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
        this.monophone.detune.setTargetAtTime(this.pitchBendDepth * e.value, safeNow(), 0.0001);
        this.noise.detune.setTargetAtTime(this.pitchBendDepth * e.value, safeNow(), 0.0001);
      }
      this.midiInput.addListener("pitchbend", pitchBend.bind(this));

      function controlChange(e) {
        const ctx = getAudioContext();
        if (e.subtype === "modulationwheelcoarse") {
          this.controls.timbre = e.value;
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
      if (this.activeColumn >= this.song.tracks.length - 1) {
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
        if (this.activeRow >= this.song.columnHeight - 1) {
          return false;
        }
        this.activeRow += delta;
        if (this.activeRow >= this.song.columnHeight) {
          this.activeRow = this.song.columnHeight - 1;
        }
      }
      return true;
    },
    incrementRowOrFrame() {
      if (this.activeRow >= this.song.columnHeight - 1) {
        if (this.activeFrameIndex >= this.song.frames.length - 1) {
          return false;
        }
        this.activeRow = 0;
        this.activeFrameIndex++;
      } else {
        this.activeRow++;
      }
      return true;
    },
    copySelected() {
      if (this.selection === undefined) {
        return;
      }
      const copied = [];
      this.song.tracks.slice(this.selection.left, this.selection.right + 1).forEach((track, i) => {
        copied.push(track.patterns[this.activeFrame[this.selection.left + i]].slice(this.selection.top, this.selection.bottom + 1));
      });
      this.copied = this.fromJSON(this.toJSON(copied));
    },
    pasteCopied() {
      if (this.activeColumn === null || this.activeRow === null || this.copied === null) {
        return;
      }
      const copied = this.fromJSON(this.toJSON(this.copied));
      this.song.tracks.slice(this.activeColumn, this.activeColumn + copied.length).forEach((track, i) => {
        track.patterns[this.activeFrame[this.activeColumn + i]].splice(this.activeRow, copied[i].length, ...copied[i]);
      });
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
      if (event.ctrlKey && event.key === "c") {
        this.copySelected();
      }
      if (event.ctrlKey && event.key === "v") {
        this.pasteCopied();
      }
      if (event.code === "NumpadDivide") {
        this.octave--;
      }
      if (event.code === "NumpadMultiply") {
        this.octave++;
      }
      if (this.activeRow >= 0 && this.activeRow < this.song.columnHeight) {
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
            this.scrollIntoView();
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
            this.scrollIntoView();
          }
        }
        if (this.inputMode === "program") {
          if (unicodeLength(event.key) === 1) {
            const cell = this.activeCells[this.activeRow];
            if (cell?.program === undefined) {
              return;
            }
            const letters = unicodeSplit(cell.program);
            letters[this.inputIndex] = event.key;
            cell.program = letters.join("");
            this.incrementRow();
            this.scrollIntoView();
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
              this.inputMode = "program";
              this.inputIndex = 0;
            }
          } else if (this.inputMode === "program") {
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
              this.inputMode = "program";
              this.inputIndex = 1;
            }
          } else if (this.inputMode === "velocity") {
            this.inputIndex--;
            if (this.inputIndex < 0) {
              this.inputIndex = 0;
              this.inputMode = "note";
            }
          } else if (this.inputMode === "program") {
            this.inputIndex--;
            if (this.inputIndex < 0) {
              this.inputIndex = 1;
              this.inputMode = "velocity";
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
        const step = x + this.mosSize;
        if (this.song.mosPattern[mod(step - 1, this.mosSize)] === "L") {
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
        monzo = this.scaleStepToMonzo(x + this.mosSize);
      } else if (y === 2) {
        const step = x;
        if (this.song.mosPattern[mod(step, this.mosSize)] === "L") {
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
      const track = {
        instrument: {
          type: 'noise',
          frequencyGlide: 1,
          attack: 1,
          release: 2,
          model: 'uniform',
          jitterModel: 'balanced',
          jitterType: 'pulseWidth',
          bitDepth: 1,
          finiteLength: 8,
          finiteSeed: 0,
          jitterBitDepth: 1,
          jitterFiniteLength: 8,
          jitterFiniteSeed: 0,
          jitterLogisticR: 4,
          diffStages: 0,
          linear: false,
          underSampling: 1,
          tableDelta: 20,
        },
        patterns: [],
      };
      while (track.patterns.length < this.song.frames.length) {
        track.patterns.push(Array(this.song.columnHeight).fill(null));
      }
      this.song.tracks.push(track);
      this.song.frames.forEach((frame, i) => frame.push(i));
    },
    addFrame() {
      this.song.tracks.forEach(track => {
        track.patterns.push(Array(this.song.columnHeight).fill(null));
      });
      const newPattern = this.song.frames.length;
      this.song.frames.push(Array(this.song.tracks.length).fill(newPattern));
    },
    selectSingle(mode, columnIndex, rowIndex, inputIndex) {
      this.activeColumn = columnIndex;
      this.activeRow = rowIndex;
      this.inputIndex = inputIndex;
      this.inputMode = mode;
      this.selectStart = null;
      this.selectStop = null;
      this.selectActive = null;
    },
    selectNothing() {
      this.activeColumn = null;
      this.inputMode = null;
      this.inputIndex = null;
      this.selectStart = null;
      this.selectStop = null;
      this.selectActive = null;
    },
    handleSelect(phase, mode, columnIndex, rowIndex) {
      if (phase === "change" && !this.selectActive) {
        return;
      }
      if (phase === "start") {
        this.selectStart = { mode, columnIndex, rowIndex };
        this.selectStop = null;
        this.selectActive = true;
      }
      if (phase === "change") {
        this.selectStop = { mode, columnIndex, rowIndex };
        if (this.selectStart.rowIndex < rowIndex) {
          this.scrollIntoView(columnIndex, Math.min(this.song.columnHeight - 1, rowIndex + 1));
        } else {
          this.scrollIntoView(columnIndex, Math.max(0, rowIndex - 1));
        }
      }
      if (phase === "stop") {
        this.selectStop = { mode, columnIndex, rowIndex };
        this.selectActive = false;
      }
    },
    choosePattern(pattern) {
      this.song.mosPattern = pattern;
      this.showMosModal = false;
    },
    chooseEdo(l, s, pattern) {
      this.song.l = l;
      this.song.s = s;
      this.song.mosPattern = pattern;
      this.showEdoModal = false;
    },
    openInstrumentModal(instrument) {
      this.activeInstrument = instrument;
      this.showInstrumentModal = true;
    },
    toJSON(data) {
      function replacer(key, value) {
        if (value === NOTE_OFF) {
          return "__NOTE_OFF";
        }
        return value;
      }
      return JSON.stringify(data, replacer);
    },
    fromJSON(string) {
      function reviver(key, value) {
        if (value === "__NOTE_OFF") {
          return NOTE_OFF;
        }
        return value;
      }
      return JSON.parse(string, reviver);
    },
    saveLocalStorage() {
      window.localStorage.lumiTrackerSong = this.toJSON(this.song);
    },
    loadLocalStorage() {
      this.song = this.fromJSON(window.localStorage.lumiTrackerSong);
    },
  },
  async mounted() {
    this.activeInstrument = this.song.tracks[0].instrument;
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mouseup", this.selectNothing);
    this.computerKeyboard = new Keyboard();
    this.computerKeyboard.addEventListener("keydown", this.computerKeydown);
    this.computerKeyboard.addEventListener("keyup", this.computerKeyup);
    window.addEventListener("keydown", this.windowKeydown);
    window.addEventListener("keyup", this.windowKeyup);
    if (navigator.requestMIDIAccess !== undefined) {
      await WebMidi.enable();
      this.midiInputs = WebMidi.inputs;
    }
    await loadAudioWorklets();
    this.monophone = new Monophone();
    this.noise = new Noise();
    this.configureInstrument(this.monophone, this.activeInstrument);

    const ctx = getAudioContext();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.globalGain = ctx.createGain();
    this.globalGain.gain.setValueAtTime(0.4, ctx.currentTime);
    this.globalGain.connect(this.analyser).connect(ctx.destination);

    this.monophone.connect(this.globalGain);
    this.noise.connect(this.globalGain);
  },
  unmounted() {
    this.computerKeyboard.removeEventListener("keydown", this.computerKeydown);
    this.computerKeyboard.removeEventListener("keyup", this.computerKeyup);
    this.computerKeyboard.dispose();
    if (this.monophone !== null) {
      this.monophone.dispose();
    }
    if (this.noise !== null) {
      this.noise.dispose();
    }
    this.globalGain.disconnect();
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mouseup", this.selectNothing);
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
    <MosModal :show="showMosModal" @close="showMosModal = false" @selectPattern="choosePattern" :currentMos="mos" />
  </Teleport>

  <Teleport to="body">
    <EdoModal ref="edoModal" :show="showEdoModal" @close="showEdoModal = false" @select="chooseEdo" />
  </Teleport>

  <Teleport to="body">
    <InstrumentModal :show="showInstrumentModal" @close="showInstrumentModal = false" :instrument="activeInstrument" />
  </Teleport>

  <div>
    <label for="audio-delay">Audio delay (ms): </label>
    <input id="audio-delay" v-model="audioDelay" type="number" min="0" />

    <label for="tempo"> BPM: </label>
    <input id="tempo" v-model="song.beatsPerMinute" type="number" min="1" />

    <button id="select-edo" @click="showEdoModal = true; $refs.edoModal.edo = divisions">select EDO</button>
    <button id="select-mos" @click="showMosModal = true">select MOS</button>
    <label for="select-mos"> = {{ song.mosPattern }}</label>

    <label for="program"> Program: </label>
    <input id="program" v-model="activeProgram" style="width:2em" />

    <label for="highlight-period"> Highlights: </label>
    <input id="highlight-period" type="number" v-model="song.highlightPeriod" />
  </div>
  <div class="break" />
  <div>
    <label for="l">L=</label>
    <input id="l" v-model="song.l" type="number">
    <label for="s"> s=</label>
    <input id="s" v-model="song.s" type="number">
    <label for="equave"> = {{divisions}}ed</label>
    <input id="equave" v-model="song.equave" type="number" step="0.01">
    <label for="frame"> Frame: </label>
    <input id="frame" v-model="activeFrameIndex" type="number" min="0" :max="song.frames.length - 1" />
    <button @click="addFrame">add frame</button>
    <label for="velocity"> Velocity: </label>
    <input id="velocity" v-model="velocity" type="number" min="0" max="255" />

    <label for="column-height"> Rows: </label>
    <input id="column-height" v-model="song.columnHeight" type="number" min="1" max="256">
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
    <label for="flats">{{ flatsStr + " "}}</label>

    <button @click="saveLocalStorage">Save</button>
    <button @click="loadLocalStorage">Load</button>
  </div>
  <div class="break"/>
  <table>
    <tr>
      <th v-for="track of song.tracks">
        <select v-model="track.instrument.waveform" @focus="activeInstrument = track.instrument" v-if="track.instrument.type === 'monophone'">
          <option v-for="waveform of waveforms">{{ waveform }}</option>
        </select>
        <select v-model="track.instrument.model" @focus="activeInstrument = track.instrument" v-if="track.instrument.type === 'noise'">
          <option v-for="model of noiseModels">{{ model }}</option>
        </select>
        <span class="instrument-config" @click="openInstrumentModal(track.instrument)">⚙</span>
      </th>
    </tr>
  </table>
  <div class="track-container">
    <TrackRowLabels
      :numRows="song.columnHeight"
      @click="(i) => activeRow = i"
      :highlightPeriod="song.highlightPeriod"
    />
    <Track
      v-for="(cells, index) of cellsWithNotes" :cells="cells"
      :key="index"
      ref="tracks"
      :active="index === activeColumn"
      :activeRow="activeRow"
      :inputMode="inputMode"
      :inputIndex="inputIndex"
      :highlightPeriod="song.highlightPeriod"
      :selected="index >= selection?.left && index <= selection?.right"
      :selection="selection"
      @cellClick="(mode, i, j) => selectSingle(mode, index, i, j)"
      @select="(phase, mode, i) => handleSelect(phase, mode, index, i)"
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
      <label for="midi-use-octave"> Use 8ve: </label>
      <input id="midi-use-octave" type="checkbox" v-model="midiUseOctave" />
      <div class="break"/>
      <div>
        <DiatonicKeyboard @noteOn="onScreenNoteOn" :activeKeys="activeMiniKeys"/>
      </div>
    </div>
    <div class="input-column">
      <h1>Computer Keyboard Input</h1>
      <ComputerKeyboard @noteOn="onScreenComputerNoteOn" :activeKeys="activeComputerKeys" />
    </div>
    <div class="input-column">
      <label for="timbre">S </label>
      <input id="timbre" type="range" min="0" max="1" step="any" v-model="controls.timbre" />
      <br>
      <label for="bias">B </label>
      <input id="bias" type="range" min="0" max="1" step="any" v-model="controls.bias" />
      <br>
      <label for="vibrato-depth">V </label>
      <input id="vibrato-depth" type="range" min="0" max="150" step="any" v-model="controls.vibratoDepth" />
      <br>
      <label for="vibrato-frequency">F </label>
      <input id="vibrato-frequency" type="range" min="0.5" max="10" step="any" v-model="controls.vibratoFrequency" />
    </div>
    <div class="input-column">
      <TimeDomainVisualizer :analyser="analyser" :width="256" :height="100" :frameHold="2" />
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
  width: 900px;
  height: 600px;
  overflow: scroll;
  user-select: none;
}

.input-container {
  margin-top: 5px;
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

/* === Modals === */

.modal-mask {
  position: fixed;
  z-index: 9998;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: table;
  transition: opacity 0.3s ease;
}

.modal-wrapper {
  display: table-cell;
  vertical-align: middle;
}

.modal-container {
  width: 700px;
  margin: 0px auto;
  padding: 20px 30px;
  background-color: #fff;
  border-radius: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.33);
  transition: all 0.3s ease;
}

.modal-header h3 {
  margin-top: 0;
  color: #42b983;
}

.modal-body {
  margin: 20px 0;
}

.modal-default-button {
  float: right;
}

/*
 * The following styles are auto-applied to elements with
 * transition="modal" when their visibility is toggled
 * by Vue.js.
 *
 * You can easily play with the modal transition by editing
 * these styles.
 */

.modal-enter-from {
  opacity: 0;
}

.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  -webkit-transform: scale(1.1);
  transform: scale(1.1);
}
</style>
