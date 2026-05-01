import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react(), tailwindcss()],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.MANUS_API_KEY': JSON.stringify(env.MANUS_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'), // 🔥 исправили
      },
    },

    server: {
      host: '0.0.0.0',
      port: 5000,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },

    // 🔥 ВОТ ЭТО ГЛАВНОЕ
    build: {
      chunkSizeWarningLimit: 1000,

      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Group React and related core libraries to avoid circular dependencies
              if (id.includes('react') || id.includes('scheduler') || id.includes('motion')) {
                return 'vendor-core';
              }
              // Group charts and data libs
              if (id.includes('recharts') || id.includes('d3') || id.includes('chart.js')) {
                return 'vendor-charts';
              }
              // Everything else in node_modules
              return 'vendor-libs';
            }
          },
        },
      },
    },
  }
})