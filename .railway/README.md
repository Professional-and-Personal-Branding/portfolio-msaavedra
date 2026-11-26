# Infraestructura de Railway como código

`railway.ts` declara el entorno `production` del portafolio: la base `Postgres` y los servicios `api` y `web`. Es la **fuente única** del entorno: lo que no figura acá, el próximo `apply` lo quita. Reemplaza a los `railway.json` de Config as Code, que Railway deja de leer el 2026-12-01.

- Decisiones y motivos: `openspec/changes/migrate-railway-iac/design.md`.
- Guía de despliegue paso a paso: `docs/DEPLOY-RAILWAY.md`.
- `railway.test.ts` comprueba, sin red, que el archivo siga alineado con el repo (scripts del backend, Dockerfile, Caddyfile, dominio y secretos). Corre en el CI (job `railway-iac`).

## Uso

CLI de Railway 5.49.1 o posterior (probada con 5.75.0). Desde la raíz del repo, con el proyecto vinculado:

```bash
npm ci --prefix .railway     # el paquete `railway` que evalúa el archivo
railway config plan          # vista previa del cambio contra el entorno vinculado
railway config apply         # lo aplica; pide confirmación antes de lo destructivo
```

Para probar el archivo sin la CLI:

```bash
npm run typecheck --prefix .railway
npm test --prefix .railway
```

## Reglas

- Nunca `--yes` ni `--confirm-destructive` sin haber leído el plan completo.
- No aplicar con el Public Access de Postgres encendido: el plan lo propondría quitar.
- Un artefacto de `--out` va fuera de `.railway/`.
- Los secretos (`JWT_SECRET`, `ANALYTICS_SALT`) se declaran con `preserve()`: su valor se carga a mano y nunca se escribe acá.
- Toda variable o ajuste se cambia en este archivo, no solo en el panel.
