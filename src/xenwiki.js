import { gcd } from "./util.js";
import { mosPatterns } from "./mos.js";
import { MOS_PATTERNS } from "./notation.js";

const TAMNAMS_MOS_NAMES = {
    // 5-note
    "2L 3s": {
        name: "pentic",
        prefix: "pent",
    },
    "3L 2s": {
        name: "antipentic",
        prefix: "apent",
    },
    "4L 1s": {
        name: "manic",
        prefix: "man",
    },
    // 6-note
    "2L 4s": {
        name: "antilemon",
        prefix: "alem",
    },
    "3L 3s": {
        name: "triwood; augmented",
        prefix: "triwood",
        abbreviation: "trw",
    },
    "4L 2s": {
        name: "lemon",
        prefix: "lem",
    },
    "5L 1s": {
        name: "machinoid",
        prefix: "mech",
    },
    // 7-note
    "2L 5s": {
        name: "antidiatonic",
        prefix: "pel",
    },
    "3L 4s": {
        name: "mosh",
        prefix: "mosh",
    },
    "4L 3s": {
        name: "smitonic",
        prefix: "smi",
    },
    "5L 2s": {
        name: "diatonic",
    },
    "6L 1s": {
        name: "archeotonic",
        prefix: "archeo",
        abbreviation: "arch",
    },
    // 8-note
    "2L 6s": {
        name: "antiechinoid",
        prefix: "anech",
    },
    "3L 5s": {
        name: "sensoid",
        prefix: "sen",
    },
    "4L 4s": {
        name: "tetrawood; diminished",
        prefix: "tetwood",
        abbreviation: "ttw",
    },
    "5L 3s": {
        name: "oneirotonic",
        prefix: "oneiro",
        abbreviation: "on",
    },
    "6L 2s": {
        name: "echinoid",
        prefix: "ech",
    },
    "7L 1s": {
        name: "pine",
        prefix: "pine",
    },
    // 9-note
    "2L 7s": {
        name: "joanatonic",
        prefix: "jo",
    },
    "3L 6s": {
        name: "tcherepnin",
        prefix: "tcher",
        abbreviation: "tch",
    },
    "4L 5s": {
        name: "orwelloid",
        prefix: "or",
    },
    "5L 4s": {
        name: "semiquartal",
        prefix: "sequar",
        abbreviation: "seq",
    },
    "6L 3s": {
        name: "hyrulic",
        prefix: "hyru",
        abbreviation: "hy",
    },
    "7L 2s": {
        name: "superdiatonic",
        prefix: "arm",
    },
    "8L 1s": {
        name: "subneutralic",
        prefix: "blu",
    },
    // 10-note
    "2L 8s": {
        name: "antidimanic",
        prefix: "adiman",
        abbreviation: "adman",
    },
    "3L 7s": {
        name: "sephiroid",
        prefix: "sephi",
        abbreviation: "seph",
    },
    "4L 6s": {
        name: "antidipentic",
        prefix: "adipen",
        abbreviation: "adpen",
    },
    "5L 5s": {
        name: "pentawood",
        prefix: "penwood",
        abbreviation: "pw",
    },
    "6L 4s": {
        name: "dipentic",
        prefix: "dipen",
        abbreviation: "dpen",
    },
    "7L 3s": {
        name: "dicotonic",
        prefix: "dico",
    },
    "8L 2s": {
        name: "dimanic",
        prefix: "diman",
        abbreviation: "dman",
    },
    "9L 1s": {
        name: "sinatonic",
        prefix: "sina",
        abbreviation: "si",
    },
    // 11-note
    "4L 7s": {
        name: "kleistonic",
    },
    // 12-note
    "5L 7s": {
        name: "p-chromatic",
    },
    "7L 5s": {
        name: "m-chromatic",
    },
};

export const MOS_PATTERN_NAMES = {
    "LsLsLs": "Tonic",
    "sLsLsL": "Dominant",

    "Lssssss": "Chinchillian",
    "sLsssss": "Badgerian",
    "ssLssss": "Zebrian",
    "sssLsss": "Dingoian",
    "ssssLss": "Gazelian",
    "sssssLs": "Lemurian",
    "ssssssL": "Pandian",

    "LssLsss": "Anti-locrian",
    "LsssLss": "Anti-phrygian",
    "sLssLss": "Anti-aeolian",
    "sLsssLs": "Anti-dorian",
    "ssLssLs": "Anti-mixolydian",
    "ssLsssL": "Anti-ionian",
    "sssLssL": "Anti-lydian",

    "LsLsLss": "Dril",
    "LsLssLs": "Gil",
    "LssLsLs": "Kleeth",
    "sLsLsLs": "Bish",
    "sLsLssL": "Fish",
    "sLssLsL": "Jwl",
    "ssLsLsL": "Led",

    "LLsLsLs": "Nerevarine",
    "LsLLsLs": "Vivecan",
    "LsLsLLs": "Lorkhanic",
    "LsLsLsL": "Sothic",
    "sLLsLsL": "Kagrenacan",
    "sLsLLsL": "Almalexian",
    "sLsLsLL": "Dagothic",

    "LLLsLLs": "Lydian",
    "LLsLLLs": "Ionian",
    "LLsLLsL": "Mixolydian",
    "LsLLLsL": "Dorian",
    "LsLLsLL": "Aeolian",
    "sLLLsLL": "Phrygian",
    "sLLsLLL": "Locrian",

    "LLLLLLLs": "Octopus",
    "LLLLLLsL": "Mantis",
    "LLLLLsLL": "Dolphin",
    "LLLLsLLL": "Crab",
    "LLLsLLLL": "Tuna",
    "LLsLLLLL": "Salmon",
    "LsLLLLLL": "Starfish",
    "sLLLLLLL": "Whale",

    "LsLsLsLs": "Tonic",
    "sLsLsLsL": "Dominant",

    "LsLssLss": "Anti-Sarnathian",
    "LssLsLss": "Anti-Hlanithian",
    "LssLssLs": "Anti-Kadathian",
    "sLsLssLs": "Anti-Mnarian",
    "sLssLsLs": "Anti-Ultharian",
    "sLssLssL": "Anti-Celephaïsian",
    "ssLsLssL": "Anti-Illarnekian",
    "ssLssLsL": "Anti-Dylathian",

    "LLsLLsLs": "Dylathian",
    "LLsLsLLs": "Illarnekian",
    "LsLLsLLs": "Celephaïsian",
    "LsLLsLsL": "Ultharian",
    "LsLsLLsL": "Mnarian",
    "sLLsLLsL": "Kadathian",
    "sLLsLsLL": "Hlanithian",
    "sLsLLsLL": "Sarnathian",

    "sssLssLssL": "Keter",
    "ssLssLssLs": "Chesed",
    "sLssLssLss": "Netzach",
    "LssLssLsss": "Malkuth",
    "ssLssLsssL": "Binah",
    "sLssLsssLs": "Tiferet",
    "LssLsssLss": "Yesod",
    "ssLsssLssL": "Chokmah",
    "sLsssLssLs": "Gevurah",
    "LsssLssLss": "Hod",

    "LsLssLssLss": "Supernerevarine",
    "LssLsLssLss": "Supervivecan",
    "LssLssLsLss": "Superbaardauan",
    "LssLssLssLs": "Superlorkhanic",
    "sLsLssLssLs": "Supervvardenic",
    "sLssLsLssLs": "Supersothic",
    "sLssLssLsLs": "Supernumidian",
    "sLssLssLssL": "Superkagrenacan",
    "ssLsLssLssL": "Supernecromic",
    "ssLssLsLssL": "Superalmalexian",
    "ssLssLssLsL": "Superdagothic",
};

for (const mos in TAMNAMS_MOS_NAMES) {
    const info = TAMNAMS_MOS_NAMES[mos]
    if (info.abbreviation === undefined && info.prefix !== undefined) {
        info.abbreviation = info.prefix;
    }
}

export function tamnamsName(mos) {
    if (mos in TAMNAMS_MOS_NAMES) {
        return TAMNAMS_MOS_NAMES[mos].name;
    }
    if (mos.startsWith("1L")) {
        const countS = parseInt(mos.slice(3, -1));
        const superMos = `${countS + 1}L 1s`;
        if (superMos in TAMNAMS_MOS_NAMES) {
            return TAMNAMS_MOS_NAMES[superMos].name + " (subset)";
        }
    }
}

export function mosPatternsWithNamesUDP(countL, countS) {
    const notationBasis = MOS_PATTERNS[`${countL}L ${countS}s`];
    const p = gcd(countL, countS);
    const result = [];
    mosPatterns(countL, countS).forEach((pattern, down) => {
        let name = "";
        if (pattern in MOS_PATTERN_NAMES) {
            name = MOS_PATTERN_NAMES[pattern];
        }
        if (pattern === "LLsLLLs") {
            name = name + " (Major)";
        } else if (pattern === "LsLLsLL") {
            name = name + " (Minor)";
        }
        const up = (countL + countS)/p - 1 - down;
        let udp;
        if (p === 1) {
            udp = `${up}|${down}`;
        } else {
            udp = `${up*p}|${down*p}(${p})`;
        }
        result.push([pattern, name, udp, pattern === notationBasis]);
    });
    return result;
}
