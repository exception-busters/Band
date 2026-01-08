import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import basicSsl from '@vitejs/plugin-basic-ssl'  // HTTPS 비활성화 (로컬 개발용)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // basicSsl()  // HTTPS 비활성화 - HTTP로 실행
  ],
  server: {
    host: true,  // LAN에서 접근 가능하도록
    port: 5173,
  },
})
