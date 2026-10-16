# Contraste de los tokens de color (WCAG 2.2, AA)

Generado por `contrast.mjs` desde la tabla `Theme` y los `themeOverrides` de la base local. Umbral 4,5:1 para texto normal; 3:1 para `accent2` (se usa en degradados y texto grande) y bordes. `text-dim` = `color-mix(in srgb, textMuted 70%, bg)` (`theme.css`).

## Temas (presets)

| Par | modern-dark | modern-light | minimal | elegant | corporate |
|---|---|---|---|---|---|
| text / bg | 16.38 | 17.06 | 17.72 | 14.91 | 16.98 |
| text / card | 14.30 | 17.85 | 17.72 | 12.99 | 17.74 |
| textMuted / bg | 7.51 | 7.24 | 7.73 | 8.08 | 7.23 |
| textMuted / card | 6.56 | 7.58 | 7.73 | 7.04 | 7.56 |
| textMuted / bgSoft (chip) | 6.92 | 6.92 | 7.41 | 7.48 | 6.87 |
| text-dim / bg | 4.20 **FALLA** | 3.49 **FALLA** | 3.62 **FALLA** | 4.60 | 3.48 **FALLA** |
| text-dim / card | 3.66 **FALLA** | 3.65 **FALLA** | 3.62 **FALLA** | 4.01 **FALLA** | 3.64 **FALLA** |
| accent (text-brand) / bg | 8.99 | 3.91 **FALLA** | 17.72 | 7.25 | 6.41 |
| accent (text-brand) / card | 7.85 | 4.10 **FALLA** | 17.72 | 6.32 | 6.70 |
| accent / badge bg-brand/10 | 7.72 | 3.45 **FALLA** | 14.46 | 6.16 | 5.51 |
| accent-foreground / accent (botón) | 8.99 | 4.10 **FALLA** | 17.72 | 7.88 | 6.70 |
| accent2 / bg | 6.46 | 4.27 | 7.73 | 10.17 | 8.35 |
| border / bg (no texto, 3:1 si es único indicador) | 1.41 **FALLA** | 1.18 **FALLA** | 1.27 **FALLA** | 1.44 **FALLA** | 1.18 **FALLA** |

## Acentos por perfil (`themeOverrides.colors.accent`) sobre su tema base

| Perfil | Tema | Acento | text-brand / bg | text-brand / card | badge | botón (fg/accent) |
|---|---|---|---|---|---|---|
| ai-software-engineer | modern-dark | #6D28D9 | 2.71 **FALLA** | 2.37 **FALLA** | 2.58 **FALLA** | 7.10 |
| all | modern-dark | #38bdf8 | 8.99 | 7.85 | 7.72 | 8.99 |
| backend-payments-ror | modern-dark | #9B1C2E | 2.38 **FALLA** | 2.08 **FALLA** | 2.31 **FALLA** | 8.08 |
| devops-azure | modern-dark | #0078D4 | 4.25 **FALLA** | 3.71 **FALLA** | 3.90 **FALLA** | 4.53 |
| devops-platform | modern-dark | #0F766E | 3.52 **FALLA** | 3.07 **FALLA** | 3.29 **FALLA** | 5.47 |
| dotnet-backend | modern-dark | #0078D4 | 4.25 **FALLA** | 3.71 **FALLA** | 3.90 **FALLA** | 4.53 |
| fullstack-microsoft | modern-dark | #0078D4 | 4.25 **FALLA** | 3.71 **FALLA** | 3.90 **FALLA** | 4.53 |
| fullstack-nest-react | modern-dark | #065F46 | 2.51 **FALLA** | 2.19 **FALLA** | 2.38 **FALLA** | 7.68 |
| generalist-polyglot | modern-dark | #0F766E | 3.52 **FALLA** | 3.07 **FALLA** | 3.29 **FALLA** | 5.47 |
| integration-architect | modern-dark | #0E5263 | 2.21 **FALLA** | 1.93 **FALLA** | 2.11 **FALLA** | 8.73 |
| it-leadership | modern-dark | #1B3A6B | 1.71 **FALLA** | 1.49 **FALLA** | 1.66 **FALLA** | 11.27 |
| java-senior-backend | modern-dark | #1A365D | 1.59 **FALLA** | 1.38 **FALLA** | 1.54 **FALLA** | 12.14 |
| software-architect | modern-dark | #1E293B | 1.32 **FALLA** | 1.15 **FALLA** | 1.29 **FALLA** | 14.63 |
| tech-lead-dotnet | modern-dark | #5B2C87 | 1.98 **FALLA** | 1.72 **FALLA** | 1.90 **FALLA** | 9.74 |

Con `?theme=<preset>` el visitante ve el acento del preset, no el del perfil (precedencia de `ThemeProvider`).

