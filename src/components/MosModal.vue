<script>
import { getHardness } from "../notation.js";
import { tamnamsName, mosPatternsWithNamesUDP } from "../xenwiki.js";

export default {
  props: {
    show: Boolean,
    currentCountL: Number,
    currentCountS: Number,
    l: Number,
    s: Number,
  },
  emits: ["close", "selectPattern"],
  data() {
    return {
      countL: null,
      countS: null,
      tamnamsName: "",
      edo: 0,
    };
  },
  computed: {
    patterns() {
      return mosPatternsWithNamesUDP(this.countL, this.countS);
    },
    footer() {
      let result = getHardness(this.l, this.s);
      if (this.edo) {
        result += " = " + this.edo.toString() + "EDO";
      }
      if (this.tamnamsName) {
        result += " " + this.tamnamsName;
      }
      return result;
    },
  },
  methods: {
    clear() {
      if (this.countL === null || this.countS === null) {
        this.tamnamsName = "";
        this.edo = 0;
      }
    },
    reset() {
      this.countL = null;
      this.countS = null;
      this.tamnamsName = "";
      this.edo = 0;
    },
    close() {
      this.reset();
      this.$emit("close");
    },
    selectPattern(pattern) {
      this.reset();
      this.$emit("selectPattern", pattern);
    },
    updateTamnams(countL, countS) {
      const name = tamnamsName(`${countL}L ${countS}s`);
      this.tamnamsName = name || "";
      this.edo = this.l * countL + this.s * countS;
    },
  },
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-mask">
      <div class="modal-wrapper">
        <div class="modal-container" @mousemove="clear">
          <div class="modal-header">
            <h1>Select MOS</h1>
          </div>

          <div class="modal-body">
            <template v-if="countL === null">
              <span class="pyramid-row" v-for="n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]">
                <button
                  v-for="l of n-1"
                  @click="countL=l; countS=(n-l); updateTamnams(l, n-l)"
                  @mouseenter="updateTamnams(l, n-l)"
                  @focus="updateTamnams(l, n-l)"
                  @mousemove.stop
                  :class="{
                    mos: true,
                    current: l === currentCountL && n-l === currentCountS,
                    sister: l === currentCountS && n-l === currentCountL,
                    parent: l === Math.min(currentCountL, currentCountS) && n === Math.max(currentCountL, currentCountS),
                    daughter: Math.max(l, n-l) === currentCountL + currentCountS && Math.min(l, n-l) === currentCountL
                  }"
                >
                  {{l}}L {{n-l}}s
                </button>
              </span>
            </template>
            <template v-else>
              <div v-for="[pattern, mode, udp, isNotationBasis] of patterns">
                <button @click="selectPattern(pattern)">{{ pattern }}</button>
                <span :class="{heavy: isNotationBasis}">{{ " " + udp }}</span>
                <span :class="{heavy: isNotationBasis}">{{ " " + mode }}</span>
              </div>
            </template>
          </div>

          <div class="modal-footer">
            <span class="name">{{ footer }}</span>
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

.mos {
  background: #eeeeee;
}
.current {
  background: #999999;
}
.parent {
  background: #eecccc;
}
.sister {
  background: #cceecc;
}
.daughter {
  background: #ccccee;
}

.heavy {
  font-weight: bold;
}

</style>
