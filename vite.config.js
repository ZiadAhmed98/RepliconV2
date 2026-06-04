import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // NODE_ENV=test is not a valid Vite mode — always build for production
  mode: 'production',

  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['apexcharts', 'react-apexcharts'],
          'vendor-pdf':    ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'vendor-excel':  ['xlsx'],
          'vendor-dnd':    ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },

  server: {
    proxy: {
      '/api': {
        target:       'http://localhost:3000',
        changeOrigin: true,
        secure:       false,
      },
    },
  },

  worker: {
    format: 'es',
  },
});
