# Tasks — add-profile-content-admin

> Referencias: `proposal.md`, `design.md` (D1–D6), `specs/*/spec.md`.
> Plantilla a copiar: `admin-experience-crud` (módulo `experience`), que ya establece capas, DTO, pipe y forma de los tests.

## 1. Perfil base (D1, D4)

- [ ] 1.1 Application: `GetProfileAdminUseCase` y `ReplaceProfileUseCase`, sin id, devolviendo los campos bilingües crudos. Verificar: specs con repositorio mockeado, incluido el caso de obligatorio vacío.
- [ ] 1.2 Domain: el puerto suma `save(profile)`; la entidad valida que `fullName`, `headline`, `summary`, `email` y `location` no queden vacíos, con `Result`. Verificar: spec de la entidad.
- [ ] 1.3 Infrastructure: `AdminProfileController` con `GET` y `PUT /api/admin/profile`, DTO con `class-validator` y `adminValidationPipe`. Verificar: e2e de los cinco escenarios de la spec.
- [ ] 1.4 Frontend `/admin/portada`: formulario con campos bilingües, contacto y disponibilidad, más la vista previa del hero vía `POST /api/admin/curated-profiles/preview`. Verificar: test de la página, incluido que la vista previa cambia sin guardar.

## 2. Idiomas y enlaces sociales (D2, D3)

- [ ] 2.1 `Language`: puerto de escritura, casos de uso, `AdminLanguageController` (`/api/admin/languages`). Verificar: e2e del CRUD.
- [ ] 2.2 `SocialLink`: ídem, con `stats` como JSON validado y `featured`. Verificar: e2e, incluido `stats` malformado → 400.
- [ ] 2.3 Los idiomas se administran dentro de `/admin/portada`; los enlaces sociales dentro de `/admin/proyectos`. Verificar: tests de las dos páginas.

## 3. Formación (D2, D3)

- [ ] 3.1 `Education`: puerto de escritura, casos de uso, controller. Verificar: e2e del CRUD.
- [ ] 3.2 `Certification`: ídem. Verificar: e2e del CRUD.
- [ ] 3.3 Frontend `/admin/formacion`: dos listas con diálogo, patrón de Skills. Verificar: test de la página, incluido ocultar sin borrar.

## 4. Proyectos (D2, D3)

- [ ] 4.1 `Project`: puerto de escritura, casos de uso, controller, con `url` y `tags`. Verificar: e2e del CRUD y que un proyecto nuevo con tags coincidentes aparece en un perfil curado.
- [ ] 4.2 Frontend `/admin/proyectos`: proyectos y enlaces sociales. Verificar: test de la página.

## 5. Analítica por origen (D5)

- [ ] 5.1 Domain: `normalizeReferrer` puro, con las tres reglas. Verificar: spec de tabla con URL con `www.`, URL con path y query, nulo, cadena basura y URL del propio `FRONTEND_URL`.
- [ ] 5.2 Application: `byReferrer` en el agregado, sin tocar la captura. Verificar: spec que comprueba que la suma de `byReferrer` iguala `total`.
- [ ] 5.3 Infrastructure: `byReferrer` en `ProfileViewsResponse` y su `@ApiProperty`. Verificar: e2e del endpoint.
- [ ] 5.4 Frontend: tabla **Por origen** en el dashboard, con su estado vacío. Verificar: test de `DashboardPage`.

## 6. Contrato, documentación y verificación

- [ ] 6.1 `npm run openapi:export` y `npm run api:types`. Verificar: test de deriva en verde.
- [ ] 6.2 Navegación del panel con las tres entradas nuevas. Verificar: test de `AdminShell`.
- [ ] 6.3 `docs/MANUAL.md`: el caso 13 pasa de "lo que no se administra" a los casos de administración de portada, formación y proyectos; se refuerza la advertencia sobre `seed` como repoblado, no como edición.
- [ ] 6.4 `docs/DEPLOY.md`: nota de que después de este change correr `seed` en producción pisa el contenido editado desde el panel.
- [ ] 6.5 Suite completa: `npm run test:all` en backend y `npm run test` en frontend. Verificar: en verde.
- [ ] 6.6 Verificación en la app real: cambiar el titular y la disponibilidad desde el panel, comprobarlo en `/` y en dos perfiles curados, y completar la `url` de los dos proyectos del seed. Verificar: capturas en `verification/`.
