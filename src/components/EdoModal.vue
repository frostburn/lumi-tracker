<script>
import { MOS_BY_EDO, getHardness } from "../notation.js";
import { tamnamsName, mosPatternsWithNames } from "../xenwiki.js";

export default {
  props: {
    show: Boolean,
  },
  emits: ["close", "select"],
  data() {
    return {
      edo: 12,
      countL: null,
      countS: null,
      s: null,
      l: null,
      tamnamsName: "",
    };
  },
  computed: {
    patterns() {
      return mosPatternsWithNames(this.countL, this.countS);
    },
    mosses() {
      if (this.edo > 8) {
        return MOS_BY_EDO.get(this.edo)?.filter(info => info[2] != 1 || info[3] != 1 );
      }
      return MOS_BY_EDO.get(this.edo);
    },
  },
  methods: {
    reset() {
      this.edo = 12;
      this.countL = null;
      this.countS = null;
      this.s = null;
      this.l = null;
      this.tamnamsName = "";
    },
    close() {
      this.reset();
      this.$emit("close");
    },
    select(pattern) {
      this.$emit("select", this.l, this.s, pattern);
      this.reset();
    },
    updateTamnams(countL, countS) {
      const name = tamnamsName(`${countL}L ${countS}s`);
      this.tamnamsName = name || "";
    },
    getHardness(l, s) {
      return getHardness(l, s);
    }
  },
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-mask">
      <div class="modal-wrapper">
        <div class="modal-container">
          <div class="modal-header">
            <h1>Select EDO</h1>
          </div>

          <div class="modal-body">
            <div v-if="countL === null" class="tall">
              <input type="number" v-model="edo" min="1" max="59" />
              <div v-for="[_countL, _countS, _l, _s] of mosses">
                <button
                  @click="countL = _countL; countS = _countS; l = _l; s = _s; updateTamnams(_countL, _countS)"
                  @mouseenter="updateTamnams(_countL, _countS)"
                  @focus="updateTamnams(_countL, _countS)"
                >
                  {{ `${_countL}L ${_countS}s` }}
                </button>
                <span>{{ " " + getHardness(_l, _s) }}</span>
              </div>
            </div>
            <template v-else>
              <div v-for="[pattern, mode] of patterns">
                <button @click="select(pattern)">{{ pattern }}</button>
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
.name::before{
   content: "\200B";
}

.tall {
  height: 450px;
}
</style>
