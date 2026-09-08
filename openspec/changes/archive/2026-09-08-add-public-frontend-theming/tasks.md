# Tasks — add-public-frontend-theming

> Referencias: `proposal.md`, `specs/*/spec.md`, `design.md` (D1–D10). Criterios de negocio: `docs/SPECS-POR-FASE.md` § Fase 4.

## 1. Contrato de tipos (D2)

- [x] 1.1 `backend/scripts/export-openapi.ts` + script `openapi:export`; generar `backend/openapi.json`. Verificar: exit 0 sin base de datos; `paths` incluye `/api/curated-profiles/{slug}`; coincide con `/api/docs-json` de la API en ejecución.
- [x] 1.2 Frontend: script `api:types` (openapi-typescript) → `src/shared/types/api.d.ts` con cabecera de hash; test `api-types.spec` que compara el hash. Verificar: test en verde; `tsc` falla al acceder a un campo inexistente (prueba manual documentada).

## 2. Bootstrap del frontend (D1, D3, D10)

- [x] 2.1 `frontend/` con Vite 8 + React 19 + TS ~5.9, Tailwind 4 (`@tailwindcss/vite`), ESLint flat + Prettier, Vitest + Testing Library + jsdom + MSW, scripts `dev/build/preview/typecheck/lint/test/api:types`; proxy `/api` → 3300; `.env.example` con `VITE_API_URL`. Verificar: `npm run dev` sirve en 5173; `npm run build` OK; `npm run test` corre.
- [x] 2.2 shadcn/ui inicializado (Tailwind 4, `new-york`, neutral) con `button, badge, card, sheet, dropdown-menu, tooltip, skeleton, separator, input`. Verificar: componentes en `shared/components/ui/`, `cn()` en `shared/lib`.
- [x] 2.3 `app/`: `providers.tsx` (QueryClient, Router), `router.tsx` (`/`, `/:slug`, `*`), `App.tsx`; cliente `openapi-fetch` en `shared/lib/api-client.ts`. Verificar: `/` y `/x` enrutan; petición tipada compila.

## 3. Motor de theming (D4)

- [x] 3.1 `themes/tokens.ts` (tipo, zod schema, DEFAULT, `mergeTokens`) + `presets/*` (5) + specs. Verificar: `tokens.spec`, `presets.spec` en verde (5 presets distintos en `bg`/`accent`).
- [x] 3.2 `themes/css-vars.ts` (+spec: mapa completo, densidad) y `themes/theme.css` (`@theme inline`, mapeo shadcn, `dark`). Verificar: utilidades `bg-bg`, `bg-accent`, `rounded-theme` compilan y responden a `--t-*`.
- [x] 3.3 `ThemeProvider` + `useTheme()` + `MotionSection` (reduced motion) + carga de fuentes; `ThemeSwitcher` con `?theme=`. Verificar: `ThemeProvider.test` (variables en el DOM, cambio sin remount, animaciones off); en navegador, cambiar preset cambia colores sin recarga y un `Button` sigue el acento.

## 4. Localización y estado de URL (D6)

- [x] 4.1 `shared/lib/url-state.ts` (+spec), `shared/i18n/messages.ts` + `useLocale`/`t()` (+spec fallback), `LocaleSwitcher`. Verificar: specs en verde; `?lang=en` cambia títulos y datos.

## 5. Datos y páginas (D7, D8)

- [x] 5.1 `useCuratedProfile` / `useCuratedProfiles` con estados `needsToken/notFound/error`; `AccessTokenForm`, `NotFound`, `ErrorState`, `LoadingSkeleton`. Verificar: `CuratedProfilePage.test` con MSW (render, 401→token→200 con header, 404, error→reintentar).
- [x] 5.2 Componentes de sección: `Hero`, `Stats` (`computeStats` + spec), `ExperienceTimeline`, `SkillsGrid`, `Projects`, `Education`, `Certifications`, `Presence`, `Contact`, con textos del diccionario. Verificar: render con datos mock sin errores; sin strings de datos hardcodeados (`grep Novacomp src` vacío).
- [x] 5.3 `TopBar` + `ProfileMenu` (agrupado por `roleType`, `techFocus`, activo resaltado, `Sheet` en móvil) + `LayoutSwitcher`. Verificar: `ProfileMenu.test` agrupa 14 perfiles del mock.
- [x] 5.4 `HomePage` (slug `all`) y `CuratedProfilePage`; título del documento por perfil. Verificar: en navegador, `/` muestra 15 experiencias y 12 categorías; `/tech-lead-dotnet` 13 experiencias.

## 6. Layouts (D5)

- [x] 6.1 `layouts/sections.ts` (`KNOWN_SECTIONS`, `orderSections`, `hasData`) + spec (orden API, faltantes al final, ocultas, vacías). Verificar: spec en verde.
- [x] 6.2 `ClassicLayout`, `SidebarLayout`, registro `resolveLayout` (+`layouts.test`). Verificar: `?layout=sidebar` reorganiza; desconocido → classic; móvil colapsa.

## 7. Verificación (Verifier)

- [x] 7.1 `npm run typecheck`, `lint`, `test`, `build` (< 400 KB gzip inicial). Verificar: todo en verde; tamaño reportado por Vite.
- [x] 7.2 En navegador contra la API real: los 7 criterios de Fase 4 (home real, `/:slug`, tema en runtime, 5 presets, ES/EN, 2 layouts, responsive 375/1280) + perfil PROTECTED con `?token=`; capturas en `openspec/changes/add-public-frontend-theming/verification/`. Registrar en `verification.md`. Máx. 3 ciclos de reparación.

## 8. Documentación (Reviewer)

- [x] 8.1 `frontend/README.md` (setup, scripts, theming, layouts, i18n); `STEPS.md` y `backend/README.md` (script `openapi:export`); `.gitignore`. Verificar: un desarrollador levanta backend + frontend desde cero.
- [x] 8.2 Sincronizar: checkbox Fase 4 en `CLAUDE.md`/`README.md`; `docs/ARCHITECTURE.md` §4 y §8.1; `docs/CHANGELOG.md`. Verificar: `openspec validate --strict` OK antes de `openspec archive`.
