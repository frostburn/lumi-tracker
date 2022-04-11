export const MIDDLE_C = 60;

export const WHITE_MIDDLE_C = 35;

export function midiNumberToWhite(number) {
    const octave = Math.floor(number / 12);
    const index = number - 12 * octave;
    if ([0, 2, 4, 5, 7, 9, 11].includes(index)) {
        return {
            number: Math.floor((index+1) / 2) + 7*octave,
            sharpOf: null,
            flatOf: null,
        };
    }
    if ([1, 3].includes(index)) {
        return {
            number: null,
            sharpOf: (index-1)/2 + 7*octave,
            flatOf: (index+1)/2 + 7*octave,
        };
    }
    return {
        number: null,
        sharpOf: index/2 + 7*octave,
        flatOf: (index+2)/2 + 7*octave,
    };
}
