#!/bin/sh
# Sequência de subida em produção.
#
# Antes isto era uma corrente de `&&` no package.json, e qualquer passo que
# falhasse impedia o servidor de subir — o container morria e o Railway
# devolvia 502 sem nada que explicasse o motivo, nem para o navegador (a
# página de erro do Railway não tem cabeçalhos CORS, então o browser ainda
# reclamava de CORS em cima do 502).
#
# Agora cada passo é tratado pelo que ele realmente é:
#   - `prisma generate` é FATAL: sem o client gerado o processo nem importa.
#   - `prisma migrate deploy` NÃO é fatal: se falhar, o servidor sobe mesmo
#     assim, o login continua funcionando e GET /api/status diz exatamente
#     qual é o problema do banco. Diagnosticar vale mais que blackout.

set -e

echo "[start] 1/3 gerando client do Prisma..."
prisma generate

set +e
echo "[start] 2/3 aplicando migrations..."
if prisma migrate deploy; then
  echo "[start] migrations aplicadas."
else
  echo "[start] AVISO: migrations FALHARAM (codigo $?)."
  echo "[start] A API vai subir assim mesmo: o login funciona, mas toda rota"
  echo "[start] que le ou grava dados vai falhar. Consulte GET /api/status"
  echo "[start] e confira DATABASE_URL e se o diretorio e gravavel."
fi
set -e

echo "[start] 3/3 subindo o servidor..."
exec bun src/main.ts
