import { terser } from 'rollup-plugin-terser';

const plugins = [terser()]

export default [
  {
    input: 'src/worklets/noise.js',
    output: [
      {
        file: 'bundles/noise.bundle.min.js',
        plugins,
      }
    ],
  },
  /*
  // Monophone registered in polyphone module
  {
    input: 'src/worklets/monophone.js',
    output: [
      {
        file: 'bundles/monophone.bundle.min.js',
        plugins,
      }
    ],
  },*/
  {
    input: 'src/worklets/polyphone.js',
    output: [
      {
        file: 'bundles/polyphone.bundle.min.js',
        plugins,
      }
    ],
  },
  {
    input: 'src/worklets/modulator.js',
    output: [
      {
        file: 'bundles/modulator.bundle.min.js',
        plugins,
      }
    ],
  },
];
