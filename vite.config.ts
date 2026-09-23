import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    base: '/',
    plugins: [react(), tailwindcss()],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.MANUS_API_KEY': JSON.stringify(env.MANUS_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        // Exclude Replit's own workflow log/state directory: it lives inside the
        // project root and is continuously appended to by the running dev server's
        // own stdout, which otherwise causes an infinite watch->reload->more-logs loop.
        ignored: ['**/.local/**', '**/.agents/**', '**/.cache/**', '**/.git/**'],
      },
    },

    build: {
      outDir: 'build',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replaceAll('\\', '/')
            if (!normalizedId.includes('/node_modules/')) return

            if (normalizedId.includes('/recharts/') || normalizedId.includes('/victory/')) return 'charts'
            if (normalizedId.includes('/lucide-react/')) return 'icons'
            if (normalizedId.includes('/xlsx/')) return 'spreadsheet'
            if (normalizedId.includes('/sql.js/')) return 'sql'
            if (normalizedId.includes('/openai/') || normalizedId.includes('/@google/genai/')) return 'ai'
            if (
              normalizedId.includes('/react/')
              || normalizedId.includes('/react-dom/')
              || normalizedId.includes('/scheduler/')
            ) return 'react'

            return 'vendor'
          },
        },
      },
    },
  }
})