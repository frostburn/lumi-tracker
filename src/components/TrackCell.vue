<script>
export default {
    props: ['note', 'velocity', 'program', 'active', 'focused', 'inputMode', 'inputIndex', 'highlight'],
    emits: ['noteClick', 'velocityClick', 'programClick'],
    computed: {
        hexVelocity() {
            if (isNaN(this.velocity)) {
                return "..";
            }
            return this.velocity.toString(16).toUpperCase().padStart(2, "0");
        },
        normalizedProgram() {
            return this.program || "..";
        },
    },
    methods: {
        scrollIntoView(options) {
            this.$refs.note.scrollIntoView(options);
        },
    },
}
</script>

<template>
    <tr :class="{active, highlight}">
        <td
            ref="note"
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
        <td class="program" :class="{ focused: focused && inputMode === 'program' }">
            <span :class="{ selected: inputIndex === 0 }" @click.stop="$emit('programClick', 0)">{{ normalizedProgram[0] }}</span>
            <span :class="{ selected: inputIndex === 1 }" @click.stop="$emit('programClick', 1)">{{ normalizedProgram[1] }}</span>
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
        column-width: 3.1ch;
        color: #eeeeee;
    }

    .velocity {
        color: lightgreen;
    }

    .program {
        color: lightcoral;
    }

    .highlight {
        background: #091906;
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
