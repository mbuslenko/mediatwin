import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['sharp', 'ffmpeg-static', 'ioredis', 'fluent-ffmpeg'],
  target: 'node18',
});
