import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './', // Use relative paths for assets
  root: 'examples',
  server: {
    fs: {
      // Allow serving files from the project root (e.g., ../dist/voro_browser.js)
      allow: ['..']
    }
  },
  build: {
    target: 'esnext',
    outDir: '../dist/examples',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'examples/index.html'),
        curve_game: resolve(__dirname, 'examples/curve_game.html'),
        custom_geometry: resolve(__dirname, 'examples/custom_geometry.html'),
        moving_cell: resolve(__dirname, 'examples/moving_cell.html'),
        performance_demo: resolve(__dirname, 'examples/performance_demo.html'),
        single_cell: resolve(__dirname, 'examples/single_cell.html'),
        voronoi_relaxation: resolve(__dirname, 'examples/voronoi_relaxation.html'),
      }
    }
  }
});
