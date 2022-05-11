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
    P1: {
        name: "Timbre snap",
        amplitude: {
            linear: false,
            data: [100],
        },
        timbre: {
            linear: true,
            data: [90, 40, 0],
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
    P2: {
        name: "Bias snap",
        amplitude: {
            linear: false,
            data: [100],
        },
        timbre: {
            linear: false,
            data: [0],
        },
        bias: {
            linear: true,
            data: [90, 40, 0],
        },
        nat: {
            linear: false,
            data: [0],
        },
    },
    P3: {
        name: "Timbre attack",
        amplitude: {
            linear: false,
            data: [100],
        },
        timbre: {
            linear: true,
            data: [0, 40, 90],
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
    P4: {
        name: "Bias attack",
        amplitude: {
            linear: false,
            data: [100],
        },
        timbre: {
            linear: false,
            data: [0],
        },
        bias: {
            linear: true,
            data: [0, 40, 90],
        },
        nat: {
            linear: false,
            data: [0],
        },
    },
    P5: {
        name: "Timbre pluck",
        amplitude: {
            linear: true,
            data: [100, 81, 66, 53, 43, 35, 28, 23, 19, 15, 12, 10, 8, 6, 5, 4, 3, 2, 1, 0],
        },
        timbre: {
            linear: true,
            data: [90, 73, 59, 48, 39, 31, 25, 21, 17, 14, 11, 9, 7, 6, 5, 4, 3, 2, 1, 0],
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
    P6: {
        name: "Bias pluck",
        amplitude: {
            linear: true,
            data: [100, 81, 66, 53, 43, 35, 28, 23, 19, 15, 12, 10, 8, 6, 5, 4, 3, 2, 1, 0],
        },
        timbre: {
            linear: false,
            data: [0],
        },
        bias: {
            linear: true,
            data: [90, 73, 59, 48, 39, 31, 25, 21, 17, 14, 11, 9, 7, 6, 5, 4, 3, 2, 1, 0],
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
    PH: {
        name: "Hi-hat",
        amplitude: {
            data: [100, 14, 2, 1, 0],
        },
        timbre: {
            linear: false,
            data: [0],
        },
        bias: {
            data: [60, 0],
        },
        nat: {
            data: [10, 0],
        },
    },
    PK: {
        name: "Kick",
        amplitude: {
            data: [100, 61, 37, 22, 14, 8, 5, 3, 2, 1, 0],
        },
        timbre: {
            data: [30, 4, 1, 0],
        },
        bias: {
            linear: false,
            data: [0],
        },
        nat: {
            data: [200, 90, 0],
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
