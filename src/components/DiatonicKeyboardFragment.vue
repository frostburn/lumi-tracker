<script>
    export default {
        props: ["activeKeys"],
        emits: ["noteOn"],
    }
</script>

<template>
    <button :class="{active: activeKeys.has(0)}" @mousedown="$emit('noteOn', 0)"/>
        <button class="black" :class="{active: activeKeys.has(1)}" @mousedown="$emit('noteOn', 1)"/>
    <button :class="{active: activeKeys.has(2)}" @mousedown="$emit('noteOn', 2)"/>
        <button class="black" :class="{active: activeKeys.has(3)}" @mousedown="$emit('noteOn', 3)"/>
    <button :class="{active: activeKeys.has(4)}" @mousedown="$emit('noteOn', 4)"/>
    <button :class="{active: activeKeys.has(5)}" @mousedown="$emit('noteOn', 5)"/>
        <button class="black" :class="{active: activeKeys.has(6)}" @mousedown="$emit('noteOn', 6)"/>
    <button :class="{active: activeKeys.has(7)}" @mousedown="$emit('noteOn', 7)"/>
        <button class="black" :class="{active: activeKeys.has(8)}" @mousedown="$emit('noteOn', 8)"/>
    <button :class="{active: activeKeys.has(9)}" @mousedown="$emit('noteOn', 9)"/>
        <button class="black" :class="{active: activeKeys.has(10)}" @mousedown="$emit('noteOn', 10)"/>
    <button :class="{active: activeKeys.has(11)}" @mousedown="$emit('noteOn', 11)"/>
</template>

<style scoped>
    button {
        position: relative;
        font-size: 5px;
        margin: 0;
        padding: 0;
        z-index: 1;
        float: left;
        width: 4em;
        height: 6em;
    }

    .black {
        z-index: 2;
        background-color: black;
        width: 0;
        border: 0;
        padding: 0 0 2em 2em;
        height: 4em;
        margin: 0 -1em 0 -1em;
    }

    .active {
        background-color: yellow;
    }
</style>
