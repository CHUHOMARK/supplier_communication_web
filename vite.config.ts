import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// 从环境变量或浏览器URL自动检测HMR主机
function getHmrHost() {
  // 优先使用显式设置的HMR_HOST
  if (process.env.HMR_HOST) return process.env.HMR_HOST;
  
  // 其次尝试从VITE_PUBLIC_URL提取
  if (process.env.VITE_PUBLIC_URL) {
    try {
      const url = new URL(process.env.VITE_PUBLIC_URL);
      return url.hostname;
    } catch (e) {
      // 如果URL格式不正确，继续
    }
  }
  
  // 返回undefined让Vite使用浏览器的location.hostname自动推断
  return undefined;
}


const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    hmr: {
      protocol: "wss",
      host: getHmrHost() || undefined,
      port: 443,
      clientPort: 443,
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
