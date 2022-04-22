<script>
import { availableNoiseModels } from "../audio.js";

export default {
  props: {
    show: Boolean,
    instrument: Object,
  },
  emits: ["close"],
  computed: {
    noiseModels() {
      return availableNoiseModels();
    },
  },
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-mask">
      <div class="modal-wrapper">
        <div class="modal-container">
          <div class="modal-header">
            <h1>Configure Instrument</h1>
          </div>

          <div class="modal-body">
            <label for="frequency-glide">Frequency glide: </label>
            <input id="frequency-glide" type="number" v-model="instrument.frequencyGlide" />
            <template v-if="instrument.type === 'monophone'">
              <label for="amplitude-glide"> Amplitude glide: </label>
              <input id="amplitude-glide" type="number" v-model="instrument.amplitudeGlide" />
            </template>
            <template v-if="instrument.type === 'noise'">
              <label for="attack"> Attack: </label>
              <input id="attack" type="number" v-model="instrument.attack" />
              <label for="release"> Release: </label>
              <input id="release" type="number" v-model="instrument.release" />
              <label for="jitter-model"> Jitter Model: </label>
              <select id="jitter-model" v-model="instrument.jitterModel">
                <option v-for="model of noiseModels">{{ model }}</option>
              </select>

              <label> Jitter Type: </label>
              <input type="radio" id="pulse-width" value="pulseWidth" v-model="instrument.jitterType" />
              <label for="pulse-width">Pulse Width</label>
              <input type="radio" id="pitch" value="pitch" v-model="instrument.jitterType" />
              <label for="pitch">Pitch</label>

              <label for="bit-depth"> Bit Depth: </label>
              <input id="bit-depth" type="number" min="1" max="31" v-model="instrument.bitDepth" />
              <label for="finite-length"> Finite Length: </label>
              <input id="finite-length" type="number" min="1" v-model="instrument.finiteLength" />
              <label for="finite-seed"> Finite Seed: </label>
              <input id="finite-seed" type="number" v-model="instrument.finiteSeed" />
              <label for="logistic-r"> Logistic r: </label>
              <input id="logistic-r" type="number" v-model="instrument.logisticR" min="3.55" max="4" step="0.01" />
              <label for="jitter-bit-depth"> Jitter Bit Depth: </label>
              <input id="jitter-bit-depth" type="number" min="1" max="31" v-model="instrument.jitterBitDepth" />
              <label for="jitter-finite-length"> Jitter Finite Length: </label>
              <input id="jitter-finite-length" type="number" min="1" v-model="instrument.jitterFiniteLength" />
              <label for="jitter-finite-seed"> Jitter Finite Seed: </label>
              <input id="jitter-finite-seed" type="number" min="1" v-model="instrument.jitterFiniteSeed" />
              <label for="jitter-logistic-r"> Jitter Logistic r: </label>
              <input id="jitter-logistic-r" type="number" v-model="instrument.jitterLogisticR" min="3.55" max="4" step="0.01" />
              <label for="diff-stages"> Diff Stages: </label>
              <input id="diff-stages" type="number" min="0" v-model="instrument.diffStages" />
              <label for="linear"> Linear: </label>
              <input id="linear" type="checkbox" v-model="instrument.linear" />
              <label for="diff-stages"> Under-sampling: </label>
              <input id="diff-stages" type="number" min="1" v-model="instrument.underSampling" />
              <label for="table-delta"> Table Delta: </label>
              <input id="table-delta" type="number" min="1" v-model="instrument.tableDelta" />
            </template>
          </div>

          <div class="modal-footer">
            <button
              class="modal-default-button"
              @click="$emit('close')"
            >Done</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
