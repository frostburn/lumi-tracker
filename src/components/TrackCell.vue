<script>
export default {
    props: ['note', 'velocity'],
    computed: {
        hexVelocity() {
            if (isNaN(this.velocity)) {
                return "..";
            }
            return this.velocity.toString(16).toUpperCase();
        },
    },
}
</script>

<template>
    <tr>
        <td class="note">{{ note || "..." }}</td>
        <td class="velocity">{{ hexVelocity }}</td>
    </tr>
</template>

<style scoped>
    tr {
        border: 1px solid gray;
    }
    td {
        color: lightgray;
        font-family: monospace;
    }

    .note {
        color: #eeeeee;
    }

    .velocity {
        color: lightgreen;
    }
</style>
