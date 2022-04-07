<script>
import TrackCell from "./TrackCell.vue";

export default {
    components: {
        TrackCell,
    },
    props: ["cells"],
}
</script>

<template>
    <table>
        <TrackCell v-for="cell of cells" v-bind=cell />
    </table>
</template>

<style scoped>
    table {
        background: black;
        border-collapse: collapse;
    }
</style>
