import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 课堂大屏 PC Web 应用，纯前端、无后端。
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
