<script>
import TrackCell from "./TrackCell.vue";

export default {
    components: {
        TrackCell,
    },
    props: ["cells", "active", "activeRow", "inputMode", "inputIndex"],
    emits: ["noteClick", "velocityClick"],
}
</script>

<template>
    <table>
        <TrackCell
            v-for="(cell, index) of cells" v-bind=cell
            :key="index"
            :active="index === activeRow"
            :focused="active && index === activeRow"
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
