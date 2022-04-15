<script>
    import { CODES_LAYER_1 } from "../keyboard.js";
    export default {
        props: ["activeKeys"],
        data() {
            return {
                layer0: CODES_LAYER_1[0],
                layer1: CODES_LAYER_1[1].slice(1),
                layer2: CODES_LAYER_1[2].slice(1),
                layer3: CODES_LAYER_1[3],
            }
        },
        emits: ["noteOn"],
    }
</script>

<template>
    <div class="layer layer0">
        <button v-for="code of layer0" :class="{ active: activeKeys.has(code) }" @click="$emit('noteOn', code)" />
    </div>
    <div class="layer layer1">
        <button v-for="code of layer1" :class="{ active: activeKeys.has(code) }" @click="$emit('noteOn', code)" />
    </div>
    <div class="layer layer2">
        <button v-for="code of layer2" :class="{ active: activeKeys.has(code) }" @click="$emit('noteOn', code)" />
    </div>
    <div class="layer layer3">
        <button class="left-shift" :class="{ active: activeKeys.has('ShiftLeft') }" />
        <button v-for="code of layer3" :class="{ active: activeKeys.has(code) }" @click="$emit('noteOn', code)" />
        <button class="right-shift" :class="{ active: activeKeys.has('ShiftRight') }" />
    </div>
</template>

<style scoped>
    .layer {
        margin: 0;
        margin-bottom: -0.72em;  /* XXX: Why? */
    }
    .layer1 {
        margin-left: 1.25em;
    }
    .layer2 {
        margin-left: 1.6em;
    }

    button {
        position: relative;
        margin: 0;
        padding: 0;
        z-index: 1;
        width: 1em;
        height: 1em;
    }
    .active {
        background-color: yellow;
    }
    .left-shift {
        width: 1.5em;
    }
    .right-shift {
        width: 2.25em;
    }
</style>
