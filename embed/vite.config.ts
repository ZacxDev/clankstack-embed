/// <reference types="node" />
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

// Library-mode build producing a single self-contained ESM bundle at dist/agent.js.
// Lit + marked are bundled in (nothing externalized) so a single
// <script type="module" src=".../agent.js"> just works on any page.
export default defineConfig({
  build: {
    target: 'es2020',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'agent.js',
    },
    rollupOptions: {
      // Externalize nothing — fully self-contained single file.
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    emptyOutDir: true,
  },
  plugins: [
    dts({
      include: ['src'],
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, 'tsconfig.json'),
    }),
  ],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
