// TODO: Decide if these are called instruments, programs or tables (or something else).
// TODO: Unify: jitter = timbre, nats -> cents

const INSTRUMENTS = {
    P0: {  // Default
        amplitude: {
            linear: false,
            data: [100],
        },
        jitter: {
            linear: false,
            data: [0],
        },
        nat: {
            linear: false,
            data: [0],
        },
    },
    PS: { // Noise - Snare
        amplitude: {
            data: [100, 90, 50, 20, 15, 20, 10, 5, 3, 2, 1, 0],
        },
        jitter: {
            data: [ 50,  0,  0,  0, 10, 50, 10, 5, 1, 0],
        },
        nat: {
            data: [100, 0],
        },
    },
};

Object.values(INSTRUMENTS).forEach(instrument => {
    Object.values(instrument).forEach(table => {
        if (table.linear === undefined) {
            table.linear = true;
        }
        if (table.loopStart === undefined) {
            table.loopStart = table.data.length - 1;
        }
        for (let i = 0; i < table.data.length; ++i) {
            table.data[i] *= 0.01;
        }
    });
});

export default INSTRUMENTS;
