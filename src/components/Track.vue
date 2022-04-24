<script>
import TrackCell from "./TrackCell.vue";

// TODO: Extend selection granularity to cell subcomponents
export default {
    components: {
        TrackCell,
    },
    props: ["cells", "active", "activeRow", "inputMode", "inputIndex", "highlightPeriod", "selected", "selection"],
    emits: ["cellClick", "select"],
    methods: {
        scrollIntoView(rowIndex, options) {
            if (rowIndex === undefined) {
                rowIndex = this.activeRow || 0;
            }
            this.$refs.cells[rowIndex].scrollIntoView(options);
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
            :class="{ selected: selected && index >= selection?.top && index <= selection?.bottom }"
            :inputMode="inputMode"
            :inputIndex="inputIndex"
            @cellClick="(mode, i) => $emit('cellClick', mode, index, i)"
            @select="(phase, mode) => $emit('select', phase, mode, index)"
        />
    </table>
</template>

<style scoped>
    table {
        float: left;
        background: black;
        border-collapse: collapse;
    }

    .selected {
        background: #aaaaff;
    }
</style>
