<script>
import { tamnamsName, mosPatternsWithNames } from "../xenwiki.js";

export default {
  props: {
    show: Boolean,
    currentMos: String,
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
      return mosPatternsWithNames(this.countL, this.countS);
    },
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
                <button
                  v-for="l of n-1"
                  @click="countL=l; countS=(n-l); updateTamnams(l, n-l)"
                  @mouseenter="updateTamnams(l, n-l)"
                  @focus="updateTamnams(l, n-l)"
                  :class="{ current: `${l}L ${n-l}s` === currentMos }"
                >
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
.pyramid-row {
  display: table;
  margin: 0 auto;
}

.name::before{
   content: "\200B";
}

.current {
  background: darkgray;
}

</style>
