<script>
import { WebMidi } from "webmidi";
import TrackRowLabels from "./components/TrackRowLabels.vue";
import Track from "./components/Track.vue";
import DiatonicKeyboard from "./components/DiatonicKeyboard.vue";
import ComputerKeyboard from "./components/ComputerKeyboard.vue";
import MosModal from "./components/MosModal.vue";
import EdoModal from "./components/EdoModal.vue";
import InstrumentModal from "./components/InstrumentModal.vue";
import { mod, NOTE_OFF, REFERENCE_FREQUENCY, REFERENCE_OCTAVE, ratioToCents, unicodeLength, unicodeSplit } from "./util.js";
import { mosMonzoToJ, mosMonzoToDiatonic, mosMonzoToSmitonic } from "./notation.js";
import { suspendAudio, resumeAudio, playFrequencies, getAudioContext, scheduleAction, setAudioDelay, safeNow } from "./audio.js";
import { Monophone, availableWaveforms, setWaveform, loadAudioWorklets, Noise, availableNoiseModels } from "./audio.js";
import { MIDDLE_C, midiNumberToWhite } from "./midi.js";
import { Keyboard } from "./keyboard.js";
import PROGRAMS from "./presets/programs.js";

const COLUMN_HEIGHT = 64;

export default {
  components: {
    MosModal,
    EdoModal,
    InstrumentModal,
    TrackRowLabels,
    Track,
    DiatonicKeyboard,
    ComputerKeyboard,
  },
  data() {
    return {
      monophone: new Monophone("oddtheta3", 0.01, 0.02),
      noise: null,  // Can only be initialized on mounting
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
      song: {
        highlightPeriod: 4,
        baseFrequency: REFERENCE_FREQUENCY,
        beatsPerMinute: 480,
        mosPattern: "LLsLLLs",
        l: 2,
        s: 1,
        equave: 2,
        frames: [[0, 0], [1, 1]],
        tracks: [
          {
            instrument: {
              type: 'monophone',
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
              logisticR: 4,
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
              Array(COLUMN_HEIGHT).fill(null),
              Array(COLUMN_HEIGHT).fill(null),
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
          setWaveform(this.monophone.oscillator, newValue.waveform);
          this.monophone.frequencyGlide = newValue.frequencyGlide / 1000;
          this.monophone.amplitudeGlide = newValue.amplitudeGlide / 1000;
        } else if (newValue.type === "noise") {
          this.configureNoise(this.noise, newValue);
        }
      },
      deep: true,
    },
    activeProgram(newValue) {
      if (newValue in PROGRAMS) {
        this.noise.setProgram(PROGRAMS[newValue]);
      }
    }
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
        const cells = track.patterns[this.activeFrame[i]];
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
    columnHeight() {
      return this.song.tracks[0].patterns[this.activeFrame[0]].length;
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
    scrollIntoView(options) {
      if (options === undefined) {
        options = {
          behavior: "auto",
          block: "nearest",
          inline: "nearest",
        };
      }
      this.$nextTick().then(() => {
        const trackComponent = this.$refs.tracks[this.activeColumn || 0];
        trackComponent.scrollIntoView(options);
      });
    },
    configureNoise(noise, instrument) {
      const data = {};
      Object.assign(data, instrument);
      data.frequencyGlide /= 1000;
      data.attack /= 1000;
      data.release /= 1000;
      data.tableDelta /= 1000;
      noise.setFullConfig(data);
    },
    play(extent) {
      this.cancelPlay();
      suspendAudio();
      const now = safeNow();
      this.song.tracks.forEach((track, i) => {
        let cells = [];
        if (extent === "frame") {
          cells = track.patterns[this.activeFrame[i]];
        } else if (extent === "song") {
          this.song.frames.forEach(frame => {
            cells = cells.concat(track.patterns[frame[i]]);
          });
        }
        if (track.instrument.type === "monophone") {
          // TODO: Use the Monophone class
          cells = this.cellsToFrequencies(cells);
          const instrument = {
            waveform: track.instrument.waveform,
            frequencyGlide: track.instrument.frequencyGlide / 1000,
            amplitudeGlide: track.instrument.amplitudeGlide / 1000,
          };
          this.cancelCallbacks.push(playFrequencies(cells, instrument, this.beatDuration));
        } else if (track.instrument.type === "noise") {
          const instrument = new Noise();
          this.configureNoise(instrument, track.instrument);

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

          this.cancelCallbacks.push(instrument.dispose.bind(instrument));
        }
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
        this.scrollIntoView({
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
        } else {
          return this.noise.noteOn(frequency, velocity / 0xFF);
        }
      } else if (this.inputMode === "note" && this.activeRow !== null) {
        if (this.activeRow >= 0 && this.activeRow < this.columnHeight) {
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
          this.monophone.vibratoDepth.setTargetAtTime(100 * e.value, safeNow(), 0.005);
          this.noise.jitter.setTargetAtTime(e.value * 0.75, safeNow(), 0.005);
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
      this.song.tracks.push({
        instrument: {
          monophonic: true,
          waveform: 'theta4',
          frequencyGlide: 10,
          amplitudeGlide: 20,
        },
        patterns: [
          Array(this.song.tracks[0].patterns[0].length).fill(null),
          Array(this.song.tracks[0].patterns[1].length).fill(null),
        ],
      });
      this.song.frames.forEach((frame, i) => frame.push(i));
    },
    addFrame() {
      this.song.tracks.forEach(track => {
        track.patterns.push(Array(this.columnHeight).fill(null));
      });
      const newPattern = this.song.frames.length;
      this.song.frames.push(Array(this.song.tracks.length).fill(newPattern));
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
    selectProgram(columnIndex, rowIndex, inputIndex) {
      this.activeColumn = columnIndex;
      this.activeRow = rowIndex;
      this.inputIndex = inputIndex;
      this.inputMode = "program";
    },
    selectNothing() {
      this.activeColumn = null;
      this.inputMode = null;
      this.inputIndex = null;
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
    saveLocalStorage() {
      function replacer(key, value) {
        if (value === NOTE_OFF) {
          return "__NOTE_OFF";
        }
        return value;
      }
      window.localStorage.lumiTrackerSong = JSON.stringify(this.song, replacer);
    },
    loadLocalStorage() {
      function reviver(key, value) {
        if (value === "__NOTE_OFF") {
          return NOTE_OFF;
        }
        return value;
      }
      this.song = JSON.parse(window.localStorage.lumiTrackerSong, reviver);
    },
  },
  async mounted() {
    this.activeInstrument = this.song.tracks[0].instrument;
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
    await loadAudioWorklets();
    this.noise = new Noise();
  },
  unmounted() {
    this.computerKeyboard.removeEventListener("keydown", this.computerKeydown);
    this.computerKeyboard.removeEventListener("keyup", this.computerKeyup);
    this.computerKeyboard.dispose();
    this.monophone.dispose();
    if (this.noise !== null) {
      this.noise.dispose();
    }
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
      :numRows="columnHeight"
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
      @noteClick="(i) => selectNote(index, i)"
      @velocityClick="(i, j) => selectVelocity(index, i, j)"
      @programClick="(i, j) => selectProgram(index, i, j)"
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
