<script>
export default {
  props: {
    show: Boolean,
    instrument: Object,
  },
  emits: ["close"],
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
            <label for="amplitude-glide"> Amplitude glide: </label>
            <input id="amplitude-glide" type="number" v-model="instrument.amplitudeGlide" />
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
