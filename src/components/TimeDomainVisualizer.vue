<script>
export default {
    props: {
        "analyser": {},
        "width": Number,
        "height": Number,
        "frameHold": Number,
    },
    data() {
        return {
            animationFrame: null,
            buffer: new Float32Array(2048),
            index: 0,
        };
    },
    methods: {
        draw() {
            this.index = (this.index + 1) % this.frameHold;
            if (this.index != 0) {
                this.animationFrame = window.requestAnimationFrame(this.draw.bind(this));
                return;
            }
            const ctx = this.$refs.canvas.getContext('2d');
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#000000";
            ctx.clearRect(0, 0, this.width, this.height);
            if (this.analyser !== null) {
                ctx.beginPath();
                if (this.buffer.length < this.analyser.fftSize) {
                    this.buffer = new Float32Array(this.analyser.fftSize);
                }
                const dx = this.width / this.analyser.fftSize;
                this.analyser.getFloatTimeDomainData(this.buffer);
                ctx.moveTo(0, this.height * 0.5 * (1 - this.buffer[0]));
                for (let i = 1; i < this.analyser.fftSize; ++i) {
                    const x = dx * i;
                    const y = this.height * 0.5 * (1 - this.buffer[i]);
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            this.animationFrame = window.requestAnimationFrame(this.draw.bind(this));
        },
    },
    mounted() {
        const ctx = this.$refs.canvas.getContext('2d');
        ctx.translate(0.5, 0.5);  // Move origin to the middle of the pixel
        this.animationFrame = window.requestAnimationFrame(this.draw.bind(this));
    },
    unmounted() {
        window.cancelAnimationFrame(this.animationFrame);
    },
}
</script>

<template>
    <canvas ref="canvas" :width="width" :height="height">
    </canvas>
</template>

<style scoped>
    canvas {
        border-style: solid;
        border-width: 1px;
        border-color: gray;
    }
</style>
