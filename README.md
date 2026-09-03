# Desenvolvimento

> [!WARNING]
> De preferência use bun como engine principal mas é possível usar npm no site usando `npm run dev:site`

## Como rodar localmente

No root do repositório:
```sh
bun install
bun run dev:site # para o site
bun run dev:api # para a api
```

# Produção

## Como inicializar o site no railway
```sh
bun install && bun run build:site
bun run start
```

## Como inicializar a api no railway

```sh
bun run start:api
```