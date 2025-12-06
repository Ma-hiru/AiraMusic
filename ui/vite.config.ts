import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export default defineConfig(({ mode }) => {
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const env = loadEnv(mode, join(__dirname, "../"), [
    "APP_",
    "NCM_",
    "GO_",
    "EXPRESS_",
    "VITE_",
    "UI_"
  ]) as ImportMetaEnv;
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
          plugins: [["babel-plugin-react-compiler"]]
        }
      })
    ],
    build: {
      outDir: join(__dirname, "../dist/ui"),
      sourcemap: false,
      rollupOptions: {
        input: {
          index: join(__dirname, "index.html"),
          info: join(__dirname, "info.html")
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
