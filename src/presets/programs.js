const PROGRAMS = {
    P0: {
        name: "Default",
        amplitude: {
            linear: false,
            data: [100],
        },
        timbre: {
            linear: false,
            data: [0],
        },
        bias: {
            linear: false,
            data: [0],
        },
        nat: {
            linear: false,
            data: [0],
        },
    },
    PS: {
        name: "Snare",
        amplitude: {
            data: [100, 90, 50, 20, 15, 20, 10, 5, 3, 2, 1, 0],
        },
        timbre: {
            linear: false,
            data: [0],
        },
        bias: {
            data: [ 50,  0,  0,  0, 10, 50, 10, 5, 1, 0],
        },
        nat: {
            data: [100, 0],
        },
    },
};

Object.values(PROGRAMS).forEach(program => {
    Object.entries(program).forEach(([parameter, table]) => {
        if (parameter === "name") {
            return;
        }
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

export default PROGRAMS;
