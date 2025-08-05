import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import aurelia from '@aurelia/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    open: !process.env.CI,
    port: 9000,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  esbuild: {
    target: 'es2022'
  },
  plugins: [
    aurelia({
      useDev: true,
    }),
    tailwindcss(),
    nodePolyfills(),
  ],
});
