<script>
import TrackCell from "./TrackCell.vue";

export default {
    components: {
        TrackCell,
    },
    props: ["cells", "activeRow"],
}
</script>

<template>
    <table>
        <TrackCell v-for="(cell, index) of cells" v-bind=cell :active="index === activeRow" />
    </table>
</template>

<style scoped>
    table {
        float: left;
        background: black;
        border-collapse: collapse;
    }
</style>
