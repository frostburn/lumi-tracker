<script>
export default {
    props: ["numRows"],
    emits: ["click"],
}
</script>

<template>
    <table>
        <tr v-for="i of numRows">
            <td @click.stop="$emit('click', i-1)">{{ ((i-1)%256).toString(16).toUpperCase().padStart(2, "0") }}</td>
        </tr>
    </table>
</template>

<style scoped>
    table {
        float: left;
        background: black;
        border-collapse: collapse;
    }
    tr {
        border: 1px solid gray;
    }
    td {
        cursor: default;
        font-family: monospace;
        column-width: 2.1ch;
        color: #bbbb55;
    }
</style>
