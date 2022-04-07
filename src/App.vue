<script>
import Track from "./components/Track.vue";
import { NOTE_OFF, mosMonzoToDiatonic } from "./util.js";

export default {
  components: {
    Track,
  },
  data() {
    return {
      mosPattern: "LsLLsLL",
      l: 2,
      s: 1,
      tracks : [
        [
          {monzo: [0, 0], velocity: 0xFF},  // A4
          null,
          {monzo: [1, 0], velocity: 0xE0},  // B4
          NOTE_OFF,
          {monzo: [1, 1], velocity: 0xD0},  // C5
          {monzo: [2, 1], velocity: 0xC0},  // D5
          {monzo: [3, 1], velocity: 0xB0},  // E5
          {monzo: [3, 2], velocity: 0xA0},  // F5
          {monzo: [4, 2], velocity: 0x90},  // G5
          {monzo: [5, 2], velocity: 0x80},  // A5
        ],
        [
          {monzo: [0, 1], velocity:0x80},
          {monzo: [1, -1], velocity:0x80},
          null,
          null,
          NOTE_OFF,
          null,
          null,
          {monzo: [1, 2], velocity:0x70},
          {monzo: [2, 0], velocity:0x70},
          null,
        ]
      ],
    }
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
    divisions() {
      return this.countL*this.l + this.countS*this.s;
    },
    tracksWithNotes() {
      const result = [];
      this.tracks.forEach(cells => {
        result.push(cells.map(cell => {
          if (cell === null) {
            return {note: "", velocity: NaN};
          }
          if (cell === NOTE_OFF) {
            return {note: "▭", velocity: NaN};
          }
          return {
            note: mosMonzoToDiatonic(cell.monzo),
            velocity: cell.velocity
          };
        }));
      });
      return result;
    }
  },
};
</script>

<template>
  <Track v-for="cells of tracksWithNotes" :cells="cells" />
</template>

<style>
@import "./assets/base.css";

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;

  font-weight: normal;
}

header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

a,
.green {
  text-decoration: none;
  color: hsla(160, 100%, 37%, 1);
  transition: 0.4s;
}

@media (hover: hover) {
  a:hover {
    background-color: hsla(160, 100%, 37%, 0.2);
  }
}

@media (min-width: 1024px) {
  body {
    background: darkgray;
    display: flex;
    place-items: center;
  }

  #app {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0 2rem;
  }

  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  .logo {
    margin: 0 2rem 0 0;
  }
}
</style>
