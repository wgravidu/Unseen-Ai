import os from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function localIPv4() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if ((address.family === 'IPv4' || address.family === 4) && !address.internal) {
        return address.address
      }
    }
  }
  return '<IP>'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})

console.log('UNSEEN AI Local: http://localhost:5173')
console.log(`UNSEEN AI Network: http://${localIPv4()}:5173 - Open this on mobile`)
