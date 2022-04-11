<script>
export default {
    props: ['note', 'velocity', 'active', 'focused', 'inputMode', 'inputIndex'],
    emits: ['noteClick', 'velocityClick'],
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
    <tr :class="{active}">
        <td
            class="note"
            :class="{ focused: focused && inputMode === 'note' }"
            @click.stop="$emit('noteClick')"
        >
            {{ note || "..." }}
        </td>
        <td class="velocity" :class="{ focused: focused && inputMode === 'velocity' }">
            <span :class="{ selected: inputIndex === 0 }" @click.stop="$emit('velocityClick', 0)">{{ hexVelocity[0] }}</span>
            <span :class="{ selected: inputIndex === 1 }" @click.stop="$emit('velocityClick', 1)">{{ hexVelocity[1] }}</span>
        </td>
    </tr>
</template>

<style scoped>
    tr {
        border: 1px solid gray;
    }
    td {
        cursor: default;
        color: lightgray;
        font-family: monospace;
    }

    .note {
        color: #eeeeee;
    }

    .velocity {
        color: lightgreen;
    }

    .active {
        background: #333333;
    }

    .focused {
        background: steelblue;
    }

    .focused .selected {
        background: blue;
    }
</style>
