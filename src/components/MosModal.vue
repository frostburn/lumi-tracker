<script>
import { mosPatterns } from "../notation.js";
import { tamnamsName, MOS_PATTERN_NAMES } from "../xenwiki.js";

export default {
  props: {
    show: Boolean,
  },
  emits: ["close", "selectPattern"],
  data() {
    return {
      countL: null,
      countS: null,
      tamnamsName: "",
    };
  },
  computed: {
    patterns() {
      const result = [];
      mosPatterns(this.countL, this.countS).forEach(pattern => {
        let name = "";
        if (pattern in MOS_PATTERN_NAMES) {
          name = MOS_PATTERN_NAMES[pattern];
        }
        if (pattern === "LLsLLLs") {
          name = name + " (Major)";
        } else if (pattern === "LsLLsLL") {
          name = name + " (Minor)";
        }
        result.push([pattern, name]);
      });
      return result;
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
    updateTamnams(countL, countS) {
      const name = tamnamsName(`${countL}L ${countS}s`);
      this.tamnamsName = name || "";
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
              <span class="pyramid-row" v-for="n of [5, 6, 7, 8, 9, 10, 11, 12]">
                <button v-for="l of n-1" @click="countL=l; countS=(n-l); updateTamnams(l, n-l)" @mouseenter="updateTamnams(l, n-l)" @focus="updateTamnams(l, n-l)">
                  {{l}}L {{n-l}}s
                </button>
              </span>
            </template>
            <template v-else>
              <div v-for="[pattern, mode] of patterns">
                <button @click="selectPattern(pattern)">{{ pattern }}</button>
                <span>{{ " " + mode }}</span>
              </div>
            </template>
          </div>

          <div class="modal-footer">
            <span class="name">{{ tamnamsName }}</span>
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

.pyramid-row {
  display: table;
  margin: 0 auto;
}

.name::before{
   content: "\200B";
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
