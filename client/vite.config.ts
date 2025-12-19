import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl()  // LAN 테스트용 HTTPS 활성화
  ],
  server: {
    host: true,  // LAN에서 접근 가능하도록
  },
})
