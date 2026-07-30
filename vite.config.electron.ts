import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  build: {
    lib: {
      entry: {
        'main/index': path.resolve(__dirname, 'src/main/index.ts'),
        'preload/index': path.resolve(__dirname, 'src/main/preload.ts'),
      },
      formats: ['cjs'],
    },
    outDir: 'dist-electron',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: [
        'electron',
        'electron-updater',
        'sqlite3',
        'node:path',
        'node:fs',
        'node:fs/promises',
        'node:child_process',
        'node:crypto',
        'node:readline',
        'node:url',
      ],
    },
  },
})
