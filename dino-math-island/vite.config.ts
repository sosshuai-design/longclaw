import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 课堂大屏 PC Web 应用，纯前端、无后端。
// 部署到 GitHub Pages 项目站点（https://<user>.github.io/longclaw/）时，
// 构建需带子路径前缀 /longclaw/；本地 dev 仍用根路径 /。
// 用自定义域名或根站点部署时，把 BASE 改成 "/" 即可。
const BASE = "/longclaw/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE : "/",
  plugins: [react()],
  server: { host: true, port: 5173 },
}));
