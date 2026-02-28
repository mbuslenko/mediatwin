import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/nestjs/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['sharp', 'ffmpeg-static', 'ioredis', 'fluent-ffmpeg', '@nestjs/common', '@nestjs/core', 'reflect-metadata'],
  target: 'node18',
});
