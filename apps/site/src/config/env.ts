// Ponto único de leitura do ambiente. Nenhum outro arquivo toca em
// `import.meta.env` — assim uma variável faltando falha aqui, com mensagem
// clara, em vez de virar `undefined` em um fetch lá na frente.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Copie .env.example para .env e preencha. ` +
        `Lembre do prefixo VITE_ — sem ele o Vite não expõe a variável para o navegador.`,
    );
  }
  return value;
}

export const env = {
  apiUrl: required("VITE_API_URL", import.meta.env.VITE_API_URL),
} as const;
