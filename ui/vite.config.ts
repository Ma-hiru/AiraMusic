import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import wasm from "vite-plugin-wasm";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadEnv, generateEnvType } from "../scripts/env";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode);
  generateEnvType(env);
  const defineEnv: Record<string, string> = {};
  for (const k in env) {
    defineEnv[`import.meta.env.${k}`] = JSON.stringify(env[k]);
  }
  return {
    define: defineEnv,
    plugins: [
      tailwindcss(),
      wasm(),
      react({
        babel: {
          plugins: [
            ["babel-plugin-react-compiler"],
            ["@babel/plugin-proposal-decorators", { version: "2023-05" }]
          ]
        }
      }),
      vue()
    ],
    build: {
      outDir: join(__dirname, "dist"),
      sourcemap: false,
      rollupOptions: {
        input: {
          index: join(__dirname, "index.html"),
          // info: join(__dirname, "info.html"),
          login: join(__dirname, "login.html"),
          // mini: join(__dirname, "mini.html"),
          lyric: join(__dirname, "lyric.html"),
          tray: join(__dirname, "tray.html"),
          image: join(__dirname, "image.html")
        }
      }
    },
    resolve: {
      alias: {
        "@mahiru/ui": join(__dirname, "./src"),
        "@": join(__dirname, "./src")
      }
    },
    server: {
      port: Number(env.VITE_SERVER_PORT),
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${env.NCM_SERVER_PORT}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "")
        },
        "/cache": {
          target: `http://127.0.0.1:${env.GO_SERVER_PORT}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cache/, "")
        }
      }
    }
  };
});
