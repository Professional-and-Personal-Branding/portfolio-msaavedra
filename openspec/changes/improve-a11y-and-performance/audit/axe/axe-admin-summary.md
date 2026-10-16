# axe-core 4.13.0 — admin

Base: http://localhost:8089 · 2026-10-15T07:23:32.424Z · etiquetas wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice.

| Regla | Impacto | Nodos | Páginas | Ejemplo |
|---|---|---|---|---|
| aria-valid-attr-value | critical | 22 | 4: panel-admin-portada.mobile, panel-builder.mobile, panel-admin-portada.desktop, panel-builder.desktop | `#radix-_r_g_-trigger-es` |
| color-contrast | serious | 420 | 16: panel-admin.mobile, panel-admin-perfiles.mobile, panel-admin-experiencias.mobile, panel-admin-skills.mobile, panel-admin-formacion.mobile, panel-admin-proyectos.mobile, … | `.p-card.surface.gap-4:nth-child(1) > div > .text-xs.text-text-dim` |
| definition-list | serious | 2 | 2: panel-builder.mobile, panel-builder.desktop | `.gap-8 > dl` |
| dlitem | serious | 20 | 2: panel-builder.mobile, panel-builder.desktop | `.items-start.gap-3:nth-child(1) > .min-w-0 > dt` |
