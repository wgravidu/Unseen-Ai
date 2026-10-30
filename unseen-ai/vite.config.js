import os from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

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

const lanIp = localIPv4()
const useHttps = process.env.VITE_HTTPS !== 'false'

// mkcert creates a local CA + cert for localhost and the LAN IP so phone
// browsers get a secure context (camera requires it). Set VITE_HTTPS=false
// to fall back to plain HTTP.
export default defineConfig({
  plugins: [react(), ...(useHttps ? [mkcert({ hosts: ['localhost', '127.0.0.1', lanIp] })] : [])],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: useHttps,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    https: useHttps,
  },
})

console.log(`UNSEEN AI Local: ${useHttps ? 'https' : 'http'}://localhost:5173`)
console.log(`UNSEEN AI Network: ${useHttps ? 'https' : 'http'}://${lanIp}:5173 - Open this on mobile (camera works on HTTPS)`)
