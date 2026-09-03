import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // O Vite inlina as variáveis VITE_* em tempo de BUILD, não de runtime. Sem
  // esta checagem, um deploy sem VITE_API_URL compila normalmente e só falha
  // no navegador, com tela branca — bem mais difícil de diagnosticar do que
  // um build que para aqui e diz o que falta.
  if (command === "build" && !env.VITE_API_URL) {
    throw new Error(
      "VITE_API_URL não está definida. Configure-a nas variáveis de ambiente " +
        "do serviço (no Railway, precisa existir no BUILD, não só no runtime) " +
        "ou em um arquivo .env — ver .env.example.",
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Espelha o `paths` do tsconfig.app.json — os dois precisam concordar,
        // senão o tipo resolve mas o bundle não (ou vice-versa).
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
