# Diseño — raise-manual-html-size-cap

## Contexto

Medición sobre `main` (2026-11-09): `index.html` pesa 295.690 bytes; la sangría inicial de las líneas suma 11.080 bytes y la nota de estado de `#resumen` unos 7,6 KB. Los 48 casos (`#publica`, `#backoffice`, `#datos`) ocupan ~135 KB y el manual del backoffice por pantalla ~52 KB: el peso crece con el contenido útil, ~3 KB por caso.

## D1 — Subir el tope a 1 MB

**Decisión:** `MAX_HTML = 1024 * 1024`.

- El límite que justifica el tope (artifact) es de 16 MB por página y cuenta también los `data:` URI. El manual no los usa: las capturas son archivos aparte, con sus propios topes.
- 1 MB deja lugar para unos 230 casos más al ritmo actual. Así el tope sigue sirviendo de alarma ante algo anómalo (una imagen embebida en base64 o un bloque duplicado por error), sin frenar al manual cuando crece normalmente.
- Un HTML de 1 MB con compresión se sirve en ~150 KB, y el manual se abre como archivo local o como artifact: el tope no afecta el rendimiento de la app.

## D2 — Descartado: reducir peso de forma estructural

- **Normalizar la sangría:** ahorra ~11 KB una sola vez (unos 3 o 4 casos) y genera un diff que tapa todo el archivo y complica los merges de los changes que están en curso y editan el manual.
- **No repetir el historial de `MANUAL.md` § 6:** ahorra ~7 KB una sola vez, y el lector del HTML pierde el estado de la corrida, que el requisito *Manual en dos formatos alineados* espera ver en los dos formatos.
- Ninguna de las dos cambia la pendiente: con cualquiera, el problema reaparece en pocos casos.

## Riesgos

- Ninguno funcional. Si el HTML se acerca a 1 MB, la decisión se revisa con datos (por ejemplo, partir los casos en páginas).
