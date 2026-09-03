import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 忽略编辑器原子写入残留的 .tmpdir（否则 chokidar 监视 EBUSY 崩溃）
    watch: {
      ignored: ["**/.tmpdir/**", "**/*.tmp"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/oss": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // 精确前缀：/actor-voice/xxx（试听音频）；避免把前端路由 /actor-voices 也代理掉
      "/actor-voice/": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
