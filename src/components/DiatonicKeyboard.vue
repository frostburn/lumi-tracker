<script>
    import DiatonicKeyboardFragment from "./DiatonicKeyboardFragment.vue";
    export default {
        components: {
            DiatonicKeyboardFragment,
        },
        props: ["activeKeys"],
        emits: ["noteOn"],
        computed: {
            lowerKeys() {
                const result = new Set();
                for (const key of this.activeKeys) {
                    if (key < 12) {
                        result.add(key);
                    }
                }
                return result;
            },
            upperKeys() {
                const result = new Set();
                for (const key of this.activeKeys) {
                    if (key >= 12) {
                        result.add(key - 12);
                    }
                }
                return result;
            },
        },
        methods: {
            lowerNoteOn(number) {
                this.$emit("noteOn", number);
            },
            upperNoteOn(number) {
                this.$emit("noteOn", number + 12);
            }
        }
    }
</script>

<template>
    <DiatonicKeyboardFragment :activeKeys="lowerKeys" @noteOn="lowerNoteOn"/>
    <DiatonicKeyboardFragment :activeKeys="upperKeys" @noteOn="upperNoteOn"/>
</template>
