<script>
import { mosPatterns } from "../notation.js";

export default {
  props: {
    show: Boolean,
  },
  emits: ["close", "selectPattern"],
  data() {
    return {
      countL: null,
      countS: null,
    };
  },
  computed: {
    patterns() {
      return mosPatterns(this.countL, this.countS);
    }
  },
  methods: {
    close() {
      this.countL = null;
      this.countS = null;
      this.$emit("close");
    },
    selectPattern(pattern) {
      this.countL = null;
      this.countS = null;
      this.$emit("selectPattern", pattern);
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
            <h1>Select MOS</h1>
          </div>

          <div class="modal-body">
            <template v-if="countL === null">
              <span class="pyramid-row" v-for="n of [5, 6, 7, 8, 9, 10, 11]">
                <button v-for="l of n-1" @click="countL=l; countS=(n-l)">
                  {{l}}L {{n-l}}s
                </button>
              </span>
            </template>
            <template v-else>
              <template v-for="pattern of patterns">
                <button class="pattern" @click="selectPattern(pattern)">{{ pattern }}</button>
              </template>
            </template>
          </div>

          <div class="modal-footer">
            <button
              class="modal-default-button"
              @click="close"
            >Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
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
  width: 600px;
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

.pyramid-row {
  display: table;
  margin: 0 auto;
}

.pattern {
  display: block;
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
