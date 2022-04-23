<script>
export default {
    props: ['note', 'velocity', 'program', 'active', 'focused', 'inputMode', 'inputIndex', 'highlight'],
    emits: ['cellClick'],
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
            @click.stop="$emit('cellClick', 'note', 0)"
        >
            {{ note || "..." }}
        </td>
        <td class="velocity" :class="{ focused: focused && inputMode === 'velocity' }">
            <span :class="{ selected: inputIndex === 0 }" @click.stop="$emit('cellClick', 'velocity', 0)">{{ hexVelocity[0] }}</span>
            <span :class="{ selected: inputIndex === 1 }" @click.stop="$emit('cellClick', 'velocity', 1)">{{ hexVelocity[1] }}</span>
        </td>
        <td class="program" :class="{ focused: focused && inputMode === 'program' }">
            <span :class="{ selected: inputIndex === 0 }" @click.stop="$emit('cellClick', 'program', 0)">{{ normalizedProgram[0] }}</span>
            <span :class="{ selected: inputIndex === 1 }" @click.stop="$emit('cellClick', 'program', 1)">{{ normalizedProgram[1] }}</span>
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
