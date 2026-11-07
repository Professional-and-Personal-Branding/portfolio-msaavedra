# Schema de JSON Resume v1.0.0 (vendorizado)

Copia **byte a byte** del schema publicado, usada solo por los tests del backend (change `add-json-resume-export`, D9). Producción no lo carga.

- Origen: https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json
- Tag `v1.0.0` del repositorio `jsonresume/resume-schema` (commit `7095651fbbb593d2c5dc2db3095412b170d74d2e`).
- Fecha de la copia: 2026-11-07.
- SHA-256: `ff6e39e79cfe6dedddf7c1e313ddb4da346bde8b055a884d7f6d849965dc27a6`
- Licencia: MIT, Copyright 2014 JSON Resume (`LICENSE.md` del tag). El `package.json` del mismo tag declara `BSD-2-Clause`; la discrepancia es del origen y no cambia nada para el uso en tests (ambas licencias permiten copiarlo con el aviso).

No reformatear ni editar: `json-resume-validator.spec.ts` compara el SHA-256 con el de este archivo. Para cambiar de versión, reemplazar el archivo, actualizar el hash y revisar D4 de `design.md`.
