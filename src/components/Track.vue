<script>
import TrackCell from "./TrackCell.vue";

export default {
    components: {
        TrackCell,
    },
    props: ["cells", "active", "activeRow", "inputMode", "inputIndex", "highlightPeriod"],
    emits: ["noteClick", "velocityClick"],
    methods: {
        scrollIntoView(options) {
            this.$refs.cells[this.activeRow || 0].scrollIntoView(options);
        },
    },
}
</script>

<template>
    <table>
        <TrackCell
            v-for="(cell, index) of cells" v-bind=cell
            ref="cells"
            :key="index"
            :active="index === activeRow"
            :focused="active && index === activeRow"
            :highlight="index % highlightPeriod === 0"
            :inputMode="inputMode"
            :inputIndex="inputIndex"
            @noteClick="$emit('noteClick', index)"
            @velocityClick="(i) => $emit('velocityClick', index, i)"
        />
    </table>
</template>

<style scoped>
    table {
        float: left;
        background: black;
        border-collapse: collapse;
    }
</style>
