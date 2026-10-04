import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The battle worker (@pkmn/sim) is code-split, which requires ES module workers.
  worker: { format: 'es' },
})
