import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export default defineConfig(() => {
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  return {
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
      sourcemap: false
    },
    resolve: {
      alias: {
        "@mahiru/ui": join(__dirname, "./src"),
        "@": join(__dirname, "./src")
      }
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:10754",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "")
        },
        "/cache": {
          target: "http://127.0.0.1:8824",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cache/, "")
        }
      }
    }
  };
});
