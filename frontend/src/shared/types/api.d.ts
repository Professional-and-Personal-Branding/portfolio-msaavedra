/* eslint-disable */
// Generado por `npm run api:types` desde backend/openapi.json. NO editar a mano.
// openapi-sha256: 4f7c4e922137812753c67f155aafb8258833d72272d5610419628115c9e505e0
export interface paths {
    "/api/admin/analytics/views": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Visitas agregadas por perfil, idioma, día y origen
         * @description El rango `from`/`to` es cerrado: `to=hoy` incluye las visitas del día en curso. El origen se normaliza al host del `referrer` guardado; las visitas desde el propio sitio cuentan como `interno`.
         */
        get: operations["AdminAnalyticsController_views"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/certifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar certificaciones (incluye ocultas, datos bilingües crudos) */
        get: operations["AdminCertificationController_list"];
        put?: never;
        /** Crear certificación */
        post: operations["AdminCertificationController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/certifications/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver certificación */
        get: operations["AdminCertificationController_find"];
        put?: never;
        post?: never;
        /** Borrar certificación */
        delete: operations["AdminCertificationController_remove"];
        options?: never;
        head?: never;
        /** Editar certificación (parcial) */
        patch: operations["AdminCertificationController_update"];
        trace?: never;
    };
    "/api/admin/curated-profiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar perfiles curados (cualquier visibilidad, datos crudos) */
        get: operations["AdminCuratedProfileController_list"];
        put?: never;
        /** Crear perfil curado */
        post: operations["AdminCuratedProfileController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/curated-profiles/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver perfil curado */
        get: operations["AdminCuratedProfileController_find"];
        put?: never;
        post?: never;
        /** Borrar perfil curado (y sus visitas) */
        delete: operations["AdminCuratedProfileController_remove"];
        options?: never;
        head?: never;
        /** Editar perfil curado (parcial) */
        patch: operations["AdminCuratedProfileController_update"];
        trace?: never;
    };
    "/api/admin/curated-profiles/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Previsualizar un borrador (no persiste)
         * @description Resuelve un perfil curado sin guardarlo, con el mismo pipeline que la ruta pública: misma selección por tags, mismo tema mergeado, mismas secciones y el mismo cuerpo de respuesta. No registra visitas y no evalúa la visibilidad.
         */
        post: operations["AdminCuratedProfileController_previewDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/education": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar formación (incluye oculta, datos bilingües crudos) */
        get: operations["AdminEducationController_list"];
        put?: never;
        /** Crear formación */
        post: operations["AdminEducationController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/education/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver formación */
        get: operations["AdminEducationController_find"];
        put?: never;
        post?: never;
        /** Borrar formación */
        delete: operations["AdminEducationController_remove"];
        options?: never;
        head?: never;
        /** Editar formación (parcial) */
        patch: operations["AdminEducationController_update"];
        trace?: never;
    };
    "/api/admin/experiences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar experiencias (incluye ocultas, datos bilingües crudos) */
        get: operations["AdminExperienceController_list"];
        put?: never;
        /** Crear experiencia */
        post: operations["AdminExperienceController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/experiences/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver experiencia */
        get: operations["AdminExperienceController_find"];
        put?: never;
        post?: never;
        /** Borrar experiencia */
        delete: operations["AdminExperienceController_remove"];
        options?: never;
        head?: never;
        /** Editar experiencia (parcial) */
        patch: operations["AdminExperienceController_update"];
        trace?: never;
    };
    "/api/admin/languages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar idiomas (datos bilingües crudos) */
        get: operations["AdminLanguageController_list"];
        put?: never;
        /** Crear idioma (en el perfil base) */
        post: operations["AdminLanguageController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/languages/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver idioma */
        get: operations["AdminLanguageController_find"];
        put?: never;
        post?: never;
        /** Borrar idioma */
        delete: operations["AdminLanguageController_remove"];
        options?: never;
        head?: never;
        /** Editar idioma (parcial) */
        patch: operations["AdminLanguageController_update"];
        trace?: never;
    };
    "/api/admin/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver el perfil base (datos bilingües crudos) */
        get: operations["AdminProfileController_find"];
        /**
         * Reemplazar el perfil base
         * @description Reemplazo completo: lo opcional que no se manda queda vacío. Un campo desconocido es 400. Los idiomas no van acá: tienen su propia ruta (`/api/admin/languages`).
         */
        put: operations["AdminProfileController_update"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/profile/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Previsualizar el perfil base sin guardarlo
         * @description Resuelve el borrador al idioma negociado con el mismo mapper que `GET /api/profile`, sobre los idiomas ya guardados. No escribe nada.
         */
        post: operations["AdminProfileController_previewDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar proyectos (incluye ocultos, datos bilingües crudos) */
        get: operations["AdminProjectController_list"];
        put?: never;
        /** Crear proyecto */
        post: operations["AdminProjectController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/projects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver proyecto */
        get: operations["AdminProjectController_find"];
        put?: never;
        post?: never;
        /** Borrar proyecto */
        delete: operations["AdminProjectController_remove"];
        options?: never;
        head?: never;
        /** Editar proyecto (parcial) */
        patch: operations["AdminProjectController_update"];
        trace?: never;
    };
    "/api/admin/skill-categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar categorías con sus skills (datos crudos) */
        get: operations["AdminSkillController_list"];
        put?: never;
        /** Crear categoría */
        post: operations["AdminSkillController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/skill-categories/{categoryId}/skills": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Crear skill en una categoría */
        post: operations["AdminSkillController_addSkill"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/skill-categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Borrar categoría y sus skills */
        delete: operations["AdminSkillController_remove"];
        options?: never;
        head?: never;
        /** Editar categoría (parcial) */
        patch: operations["AdminSkillController_update"];
        trace?: never;
    };
    "/api/admin/skills/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Borrar skill */
        delete: operations["AdminSkillController_removeSkill"];
        options?: never;
        head?: never;
        /** Editar skill (nombre, tags, orden, categoría) */
        patch: operations["AdminSkillController_editSkill"];
        trace?: never;
    };
    "/api/admin/social-links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar enlaces sociales (incluye ocultos, datos bilingües crudos) */
        get: operations["AdminSocialLinkController_list"];
        put?: never;
        /** Crear enlace social */
        post: operations["AdminSocialLinkController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/social-links/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver enlace social */
        get: operations["AdminSocialLinkController_find"];
        put?: never;
        post?: never;
        /** Borrar enlace social */
        delete: operations["AdminSocialLinkController_remove"];
        options?: never;
        head?: never;
        /** Editar enlace social (parcial) */
        patch: operations["AdminSocialLinkController_update"];
        trace?: never;
    };
    "/api/admin/themes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar temas disponibles
         * @description Catálogo para el customizador: los `id` son los que acepta `themeId` en el CRUD de perfiles curados y en el preview.
         */
        get: operations["AdminThemeController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login del backoffice
         * @description Devuelve un JWT Bearer y lo emite además como cookie de sesión `portfolio_session` (httpOnly), que usa el panel de administración.
         */
        post: operations["AuthController_doLogin"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cierre de sesión del backoffice
         * @description Borra la cookie de sesión. No requiere una sesión válida.
         */
        post: operations["AuthController_doLogout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Administrador autenticado
         * @description Acepta el JWT por header `Authorization: Bearer` o por la cookie de sesión.
         */
        get: operations["AuthController_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/certifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Certificaciones visibles */
        get: operations["EducationController_certifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/curated-profiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Perfiles curados públicos
         * @description Listado para el menú de navegación (solo PUBLIC), agrupable por `roleType`.
         */
        get: operations["CuratedProfileController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/curated-profiles/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Perfil curado resuelto
         * @description Experiencias y skills filtradas por intersección de tags con overrides, orden cronológico, tema resuelto y secciones. Perfiles PROTECTED requieren el token por header `X-Access-Token` o query `token`. Cada respuesta 200 registra una visita (analítica, IP solo como hash).
         */
        get: operations["CuratedProfileController_findBySlug"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/education": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Formación académica visible */
        get: operations["EducationController_education"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Experiencias laborales visibles
         * @description Ordenadas por `order` ascendente y `startDate` descendente. Campos traducibles resueltos al locale negociado.
         */
        get: operations["ExperienceController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiences/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalle de una experiencia visible */
        get: operations["ExperienceController_findById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Perfil profesional base
         * @description Campos traducibles resueltos al locale negociado.
         */
        get: operations["ProfileController_find"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Proyectos destacados visibles */
        get: operations["ProjectController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/profile-head": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Fragmento de head por perfil (HTML)
         * @description Metadatos del perfil para el HTML inicial: title, description, canonical, Open Graph, Twitter Card, robots y JSON-LD. Siempre 200. Un perfil PROTECTED, PRIVATE o inexistente devuelve el fragmento genérico con `noindex, nofollow`. No acepta token ni registra visitas.
         */
        get: operations["ProfileHeadController_head"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/social-links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Presencia pública (GitHub, LinkedIn, YouTube…) visible */
        get: operations["SocialLinkController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AdminAvailabilityResponse: {
            contractType: components["schemas"]["LocalizedTextDto"] | null;
            modality: components["schemas"]["LocalizedTextDto"] | null;
            startDate: components["schemas"]["LocalizedTextDto"] | null;
        };
        AdminCertificationResponse: {
            id: string;
            /** @example CertifPro, Sunrise Florida, EEUU */
            issuer: string;
            name: components["schemas"]["LocalizedTextDto"];
            order: number;
            visible: boolean;
            /** @example 2021 */
            year: string | null;
        };
        AdminCuratedProfileResponse: {
            /** @example #5B2C87 */
            accentColor: string;
            accessToken: string | null;
            createdAt: string | null;
            description: components["schemas"]["LocalizedTextDto"] | null;
            excludeIds: string[];
            filterTags: string[];
            headline: components["schemas"]["LocalizedTextDto"];
            id: string;
            includeIds: string[];
            /** @example classic */
            layout: string;
            roleType: components["schemas"]["LocalizedTextDto"] | null;
            sectionsHidden: string[];
            sectionsOrder: string[];
            /** @example tech-lead-dotnet */
            slug: string;
            techFocus: string | null;
            themeId: string | null;
            themeOverrides: {
                [key: string]: unknown;
            } | null;
            title: components["schemas"]["LocalizedTextDto"];
            updatedAt: string | null;
            views: number;
            /** @enum {string} */
            visibility: "PUBLIC" | "PRIVATE" | "PROTECTED";
        };
        AdminEducationResponse: {
            degree: components["schemas"]["LocalizedTextDto"];
            endDate: string | null;
            id: string;
            inProgress: boolean;
            /** @example UAGRM School of Engineering */
            institution: string;
            order: number;
            /** @example 2024-02 */
            startDate: string;
            visible: boolean;
        };
        AdminExperienceResponse: {
            company: string;
            createdAt: string | null;
            current: boolean;
            endDate: string | null;
            highlights: components["schemas"]["LocalizedListDto"];
            id: string;
            location: string;
            order: number;
            role: components["schemas"]["LocalizedTextDto"];
            sector: string[];
            /** @example 2025-01 */
            startDate: string;
            summary: components["schemas"]["LocalizedTextDto"];
            tags: string[];
            technologies: string[];
            updatedAt: string | null;
            visible: boolean;
        };
        AdminLanguageResponse: {
            detail: components["schemas"]["LocalizedTextDto"] | null;
            id: string;
            /** @example B2 */
            level: string;
            /** @example Inglés */
            name: string;
            nameI18n: components["schemas"]["LocalizedTextDto"] | null;
        };
        AdminProfileResponse: {
            availability: components["schemas"]["AdminAvailabilityResponse"];
            email: string;
            fullName: string;
            headline: components["schemas"]["LocalizedTextDto"];
            id: string;
            location: string;
            phone: string | null;
            summary: components["schemas"]["LocalizedTextDto"];
            timezone: string;
            yearsOfExperience: number;
        };
        AdminProjectResponse: {
            id: string;
            /** @example Portafolio Web Administrable */
            name: string;
            order: number;
            /** @example 2026 */
            period: string;
            role: components["schemas"]["LocalizedTextDto"];
            summary: components["schemas"]["LocalizedTextDto"];
            tags: string[];
            technologies: string[];
            url: string | null;
            visible: boolean;
        };
        AdminResponse: {
            /** @example admin@example.com */
            email: string;
            /** @example clx0admin */
            id: string;
            /** @example Manuel Saavedra */
            name: string;
        };
        AdminSkillCategoryResponse: {
            id: string;
            name: components["schemas"]["LocalizedTextDto"];
            order: number;
            skills: components["schemas"]["AdminSkillResponse"][];
        };
        AdminSkillResponse: {
            categoryId: string | null;
            id: string;
            /** @example Kafka Streams */
            name: string;
            order: number;
            tags: string[];
        };
        AdminSocialLinkResponse: {
            description: components["schemas"]["LocalizedTextDto"] | null;
            featured: boolean;
            /** @example manuXD270516 */
            handle: string;
            id: string;
            label: components["schemas"]["LocalizedTextDto"];
            order: number;
            /** @example github */
            platform: string;
            /**
             * @example {
             *       "repos": 67,
             *       "achievements": [
             *         "Pull Shark"
             *       ]
             *     }
             */
            stats: {
                [key: string]: unknown;
            } | null;
            /** @example https://github.com/manuXD270516 */
            url: string;
            visible: boolean;
        };
        AvailabilityDto: {
            /** @description Tipo de contrato */
            contractType?: components["schemas"]["LocalizedTextDto"] | null;
            /** @description Modalidad */
            modality?: components["schemas"]["LocalizedTextDto"] | null;
            /** @description Fecha de inicio */
            startDate?: components["schemas"]["LocalizedTextDto"] | null;
        };
        AvailabilityResponse: {
            /** @example Relación de dependencia · Freelance / Contractor */
            contractType: string;
            /** @example Remoto / Presencial (Santa Cruz) */
            modality: string;
            /** @example Inmediata */
            startDate: string;
        };
        CertificationResponse: {
            id: string;
            /** @example CertifPro */
            issuer: string;
            /**
             * @description Resuelto al locale.
             * @example Scrum Foundation Professional Certificate
             */
            name: string;
            order: number;
            /** @example 2021 */
            year: string | null;
        };
        CountByDay: {
            /** @example 2026-09-07 */
            day: string;
            views: number;
        };
        CountByLocale: {
            locale: string;
            views: number;
        };
        CountByReferrer: {
            /**
             * @description Host del origen sin `www.`, o `directo` / `interno`
             * @example linkedin.com
             */
            referrer: string;
            views: number;
        };
        CountBySlug: {
            slug: string;
            views: number;
        };
        CreateCertificationDto: {
            /** @example CertifPro, Sunrise Florida, EEUU */
            issuer: string;
            name: components["schemas"]["LocalizedTextDto"];
            /** @default 0 */
            order: number;
            /** @default true */
            visible: boolean;
            /**
             * @description YYYY; omitir o null si no se conoce
             * @example 2021
             */
            year?: string | null;
        };
        CreateCuratedProfileDto: {
            /**
             * @default #1A365D
             * @example #5B2C87
             */
            accentColor: string;
            /** @description Obligatorio si visibility = PROTECTED */
            accessToken?: string | null;
            description?: components["schemas"]["LocalizedTextDto"] | null;
            /** @default [] */
            excludeIds: string[];
            /** @default [] */
            filterTags: string[];
            /** @description Titular propio del perfil. Omitido o vacío, el hero muestra el titular del perfil base (add-profile-content-admin, D7). */
            headline?: components["schemas"]["LocalizedTextDto"];
            /** @default [] */
            includeIds: string[];
            /** @default classic */
            layout: string;
            roleType?: components["schemas"]["LocalizedTextDto"] | null;
            /** @default [] */
            sectionsHidden: components["schemas"]["SectionId"][];
            /** @default [] */
            sectionsOrder: components["schemas"]["SectionId"][];
            /**
             * @description kebab-case, único
             * @example qa-lead
             */
            slug: string;
            /** @example .NET */
            techFocus?: string | null;
            /** @description Id de Theme existente */
            themeId?: string | null;
            themeOverrides?: {
                [key: string]: unknown;
            } | null;
            title: components["schemas"]["LocalizedTextDto"];
            /**
             * @default PUBLIC
             * @enum {string}
             */
            visibility: "PUBLIC" | "PRIVATE" | "PROTECTED";
        };
        CreateEducationDto: {
            degree: components["schemas"]["LocalizedTextDto"];
            /**
             * @description YYYY-MM o YYYY; omitir o null si está en curso
             * @example 2021-04
             */
            endDate?: string | null;
            /** @default false */
            inProgress: boolean;
            /** @example UAGRM School of Engineering */
            institution: string;
            /** @default 0 */
            order: number;
            /**
             * @description YYYY-MM o YYYY
             * @example 2024-02
             */
            startDate: string;
            /** @default true */
            visible: boolean;
        };
        CreateExperienceDto: {
            /** @example ACME Corp */
            company: string;
            /** @default false */
            current: boolean;
            /**
             * @description YYYY-MM; omitir o null si es actual
             * @example 2025-12
             */
            endDate?: string | null;
            highlights?: components["schemas"]["LocalizedListDto"];
            /** @example Santa Cruz, Bolivia · Remoto */
            location: string;
            /** @default 0 */
            order: number;
            role: components["schemas"]["LocalizedTextDto"];
            /** @default [] */
            sector: string[];
            /**
             * @description YYYY-MM
             * @example 2025-01
             */
            startDate: string;
            summary: components["schemas"]["LocalizedTextDto"];
            /**
             * @description Tags para el filtrado de perfiles curados
             * @default []
             */
            tags: string[];
            /** @default [] */
            technologies: string[];
            /** @default true */
            visible: boolean;
        };
        CreateLanguageDto: {
            detail?: components["schemas"]["LocalizedTextDto"] | null;
            /** @example B2 */
            level: string;
            /**
             * @description Nombre canónico; fallback de nameI18n
             * @example Inglés
             */
            name: string;
            nameI18n?: components["schemas"]["LocalizedTextDto"] | null;
        };
        CreateProjectDto: {
            /** @example Portafolio Web Administrable */
            name: string;
            /** @default 0 */
            order: number;
            /** @example 2026 */
            period: string;
            role: components["schemas"]["LocalizedTextDto"];
            summary: components["schemas"]["LocalizedTextDto"];
            /**
             * @description Tags para el filtrado de perfiles curados
             * @default []
             */
            tags: string[];
            /** @default [] */
            technologies: string[];
            /**
             * @description URL http(s) absoluta; null para quitarla
             * @example https://github.com/manu/portafolio
             */
            url?: string | null;
            /** @default true */
            visible: boolean;
        };
        CreateSkillCategoryDto: {
            name: components["schemas"]["LocalizedTextDto"];
            /** @default 0 */
            order: number;
        };
        CreateSkillDto: {
            /** @example Kafka Streams */
            name: string;
            /** @default 0 */
            order: number;
            /**
             * @description Tags para el filtrado
             * @default []
             */
            tags: string[];
        };
        CreateSocialLinkDto: {
            /** @description null para quitarla */
            description?: components["schemas"]["LocalizedTextDto"] | null;
            /** @default false */
            featured: boolean;
            /** @example manuXD270516 */
            handle: string;
            label: components["schemas"]["LocalizedTextDto"];
            /** @default 0 */
            order: number;
            /**
             * @description Minúsculas, dígitos y guiones
             * @example github
             */
            platform: string;
            /**
             * @description Objeto JSON libre; null para quitarlo. Arrays y primitivos → 400
             * @example {
             *       "repos": 67,
             *       "achievements": [
             *         "Pull Shark"
             *       ]
             *     }
             */
            stats?: {
                [key: string]: unknown;
            } | null;
            /**
             * @description URL http(s) absoluta
             * @example https://github.com/manuXD270516
             */
            url: string;
            /** @default true */
            visible: boolean;
        };
        CuratedProfileResponse: {
            /** @example #5B2C87 */
            accentColor: string;
            certifications: components["schemas"]["CertificationResponse"][];
            /** @description Resuelto al locale. */
            description: string;
            education: components["schemas"]["EducationResponse"][];
            /** @description Filtradas por tags/overrides, orden cronológico. */
            experiences: components["schemas"]["ExperienceResponse"][];
            /** @description Resuelto al locale. */
            headline: string;
            /**
             * @example [
             *       "education"
             *     ]
             */
            hiddenSections: string[];
            /** @example classic */
            layout: string;
            profile: components["schemas"]["ProfileResponse"] | null;
            /** @description Seleccionados por tags/overrides. */
            projects: components["schemas"]["ProjectResponse"][];
            /**
             * @description Tipo de rol para agrupar el menú. Resuelto al locale.
             * @example Tech Lead
             */
            roleType: string;
            /**
             * @example [
             *       "hero",
             *       "stats",
             *       "experience",
             *       "skills",
             *       "contact"
             *     ]
             */
            sections: string[];
            skillCategories: components["schemas"]["SkillCategoryResponse"][];
            /** @example tech-lead-dotnet */
            slug: string;
            socialLinks: components["schemas"]["SocialLinkResponse"][];
            /** @example .NET */
            techFocus: string | null;
            theme: components["schemas"]["ResolvedThemeResponse"] | null;
            /**
             * @description Resuelto al locale.
             * @example Tech Lead · .NET
             */
            title: string;
            /**
             * @example PUBLIC
             * @enum {string}
             */
            visibility: "PUBLIC" | "PRIVATE" | "PROTECTED";
        };
        CuratedProfileSummaryResponse: {
            /** @example #5B2C87 */
            accentColor: string;
            /** @description Resuelto al locale. */
            description: string;
            /** @description Resuelto al locale. */
            headline: string;
            /** @example classic */
            layout: string;
            /**
             * @description Tipo de rol para agrupar el menú. Resuelto al locale.
             * @example Tech Lead
             */
            roleType: string;
            /** @example tech-lead-dotnet */
            slug: string;
            /** @example .NET */
            techFocus: string | null;
            /**
             * @description Resuelto al locale.
             * @example Tech Lead · .NET
             */
            title: string;
        };
        EducationResponse: {
            /**
             * @description Resuelto al locale.
             * @example Doctorado en Ciencias de la Computación
             */
            degree: string;
            endDate: string | null;
            id: string;
            inProgress: boolean;
            /** @example UAGRM School of Engineering */
            institution: string;
            order: number;
            /** @example 2024-02 */
            startDate: string;
        };
        ErrorResponseDto: {
            /** @example Not Found */
            error: string;
            /** @example Experiencia con id "abc" no encontrado */
            message: string;
            /**
             * @description Identificador de la petición; coincide con la cabecera `X-Request-Id` y con el log.
             * @example 3f1c9a2e-5b7d-4c8e-9a10-2b3c4d5e6f70
             */
            requestId?: string;
            /** @example 404 */
            statusCode: number;
            /** @example 2026-09-08T18:45:02.446Z */
            timestamp: string;
        };
        ExperienceResponse: {
            /** @example Novacomp */
            company: string;
            /** @example false */
            current: boolean;
            /**
             * @description YYYY-MM; null si es la posición actual
             * @example 2026-08
             */
            endDate: string | null;
            /** @description Logros, resueltos al locale del request. */
            highlights: string[];
            /** @example clx0abc123 */
            id: string;
            /** @example Santa Cruz, Bolivia · Remoto */
            location: string;
            /** @example 0 */
            order: number;
            /**
             * @description Resuelto al locale del request.
             * @example Senior Fullstack Developer · Fintech
             */
            role: string;
            /**
             * @example [
             *       "fintech",
             *       "payments"
             *     ]
             */
            sector: string[];
            /**
             * @description YYYY-MM
             * @example 2026-03
             */
            startDate: string;
            /** @description Resuelto al locale del request. */
            summary: string;
            /**
             * @description Tags para el filtrado de perfiles curados.
             * @example [
             *       "java",
             *       "fintech"
             *     ]
             */
            tags: string[];
            /**
             * @example [
             *       "Java",
             *       "Spring Boot"
             *     ]
             */
            technologies: string[];
        };
        LanguageResponse: {
            /** @example Oral, escrito y lectura avanzados */
            detail: string;
            /** @example Nativo */
            level: string;
            /** @example Español */
            name: string;
        };
        LocalizedListDto: {
            /**
             * @example [
             *       "Design of the tokenization microservice"
             *     ]
             */
            en?: string[];
            /**
             * @example [
             *       "Diseño del microservicio de tokenización"
             *     ]
             */
            es: string[];
        };
        LocalizedTextDto: {
            /** @example Senior Software Engineer */
            en?: string;
            /** @example Ingeniero de Software Senior */
            es: string;
        };
        LoginDto: {
            /** @example admin@example.com */
            email: string;
            /** @example contraseña-segura */
            password: string;
        };
        LoginResponse: {
            /** @description JWT HS256 */
            accessToken: string;
            /**
             * @description Segundos hasta la expiración
             * @example 86400
             */
            expiresIn: number;
            /**
             * @example Bearer
             * @enum {string}
             */
            tokenType: "Bearer";
            user: components["schemas"]["AdminResponse"];
        };
        PreviewCuratedProfileDto: {
            /**
             * @default #1A365D
             * @example #5B2C87
             */
            accentColor: string;
            /** @description Obligatorio si visibility = PROTECTED */
            accessToken?: string | null;
            description?: components["schemas"]["LocalizedTextDto"] | null;
            /** @default [] */
            excludeIds: string[];
            /** @default [] */
            filterTags: string[];
            /** @description Titular propio del perfil. Omitido o vacío, el hero muestra el titular del perfil base (add-profile-content-admin, D7). */
            headline?: components["schemas"]["LocalizedTextDto"];
            /** @default [] */
            includeIds: string[];
            /** @default classic */
            layout: string;
            roleType?: components["schemas"]["LocalizedTextDto"] | null;
            /** @default [] */
            sectionsHidden: components["schemas"]["SectionId"][];
            /** @default [] */
            sectionsOrder: components["schemas"]["SectionId"][];
            /**
             * @description kebab-case, único
             * @example qa-lead
             */
            slug?: string;
            /** @example .NET */
            techFocus?: string | null;
            /** @description Id de Theme existente */
            themeId?: string | null;
            themeOverrides?: {
                [key: string]: unknown;
            } | null;
            title?: components["schemas"]["LocalizedTextDto"];
            /**
             * @default PUBLIC
             * @enum {string}
             */
            visibility: "PUBLIC" | "PRIVATE" | "PROTECTED";
        };
        PreviewProfileDto: {
            availability?: components["schemas"]["AvailabilityDto"];
            /** @example manuel@example.com */
            email: string;
            /** @example Manuel Saavedra */
            fullName: string;
            headline: components["schemas"]["LocalizedTextDto"];
            /** @example Santa Cruz, Bolivia */
            location: string;
            /** @example +591 70000000 */
            phone?: string | null;
            summary: components["schemas"]["LocalizedTextDto"];
            /** @default GMT-4 */
            timezone: string;
            /** @default 0 */
            yearsOfExperience: number;
        };
        ProfileResponse: {
            availability: components["schemas"]["AvailabilityResponse"];
            /** @example correo@example.com */
            email: string;
            /** @example Manuel Joaquín Saavedra Severiche */
            fullName: string;
            /**
             * @description Resuelto al locale del request.
             * @example Senior Software Engineer · Backend & Cloud
             */
            headline: string;
            /** @example clx0abc123 */
            id: string;
            languages: components["schemas"]["LanguageResponse"][];
            /** @example Santa Cruz de la Sierra, Bolivia */
            location: string;
            /** @example +591 70000000 */
            phone: string | null;
            /** @description Resuelto al locale del request. */
            summary: string;
            /** @example GMT-4 */
            timezone: string;
            /** @example 10 */
            yearsOfExperience: number;
        };
        ProfileViewsResponse: {
            byDay: components["schemas"]["CountByDay"][];
            byLocale: components["schemas"]["CountByLocale"][];
            byProfile: components["schemas"]["CountBySlug"][];
            /** @description Por origen, descendente. Su suma es `total`; solo se agrega el host */
            byReferrer: components["schemas"]["CountByReferrer"][];
            from: string;
            to: string;
            total: number;
        };
        ProjectResponse: {
            id: string;
            /** @example Portafolio Web Administrable */
            name: string;
            order: number;
            /** @example 2026 */
            period: string;
            /** @description Resuelto al locale. */
            role: string;
            /** @description Resuelto al locale. */
            summary: string;
            /** @description Tags para el filtrado de perfiles curados */
            tags: string[];
            technologies: string[];
            url: string | null;
        };
        ReplaceProfileDto: {
            availability?: components["schemas"]["AvailabilityDto"];
            /** @example manuel@example.com */
            email: string;
            /** @example Manuel Saavedra */
            fullName: string;
            headline: components["schemas"]["LocalizedTextDto"];
            /** @example Santa Cruz, Bolivia */
            location: string;
            /** @example +591 70000000 */
            phone?: string | null;
            summary: components["schemas"]["LocalizedTextDto"];
            /** @default GMT-4 */
            timezone: string;
            /** @default 0 */
            yearsOfExperience: number;
        };
        ResolvedThemeResponse: {
            /** @example true */
            isPreset: boolean;
            /** @example Modern Dark */
            name: string;
            /** @example modern-dark */
            slug: string;
            /**
             * @description Design tokens ya combinados (tema base + overrides del perfil).
             * @example {
             *       "mode": "dark",
             *       "colors": {
             *         "bg": "#0a0e1a",
             *         "accent": "#38bdf8"
             *       }
             *     }
             */
            tokens: {
                [key: string]: unknown;
            };
        };
        /** @enum {string} */
        SectionId: "hero" | "stats" | "experience" | "skills" | "projects" | "education" | "certifications" | "presence" | "contact";
        SkillCategoryResponse: {
            /**
             * @description Resuelto al locale.
             * @example Lenguajes
             */
            name: string;
            /**
             * @example [
             *       "Java (8-21)",
             *       "TypeScript"
             *     ]
             */
            skills: string[];
        };
        SocialLinkResponse: {
            /** @description Resuelto al locale; vacío si no hay. */
            description: string;
            featured: boolean;
            /** @example manuXD270516 */
            handle: string;
            id: string;
            /** @description Resuelto al locale. */
            label: string;
            order: number;
            /** @example github */
            platform: string;
            /**
             * @example {
             *       "repos": 67,
             *       "achievements": [
             *         "Pull Shark"
             *       ]
             *     }
             */
            stats: {
                [key: string]: unknown;
            } | null;
            /** @example https://github.com/manuXD270516 */
            url: string;
        };
        ThemeResponse: {
            /** @example clx0theme1 */
            id: string;
            /** @example true */
            isPreset: boolean;
            /** @example Modern Dark */
            name: string;
            /** @example modern-dark */
            slug: string;
            /**
             * @description Design tokens del tema base, sin overrides.
             * @example {
             *       "mode": "dark",
             *       "colors": {
             *         "bg": "#0a0e1a",
             *         "accent": "#38bdf8"
             *       }
             *     }
             */
            tokens: {
                [key: string]: unknown;
            };
        };
        UpdateCertificationDto: {
            /** @example CertifPro, Sunrise Florida, EEUU */
            issuer?: string;
            name?: components["schemas"]["LocalizedTextDto"];
            /** @default 0 */
            order: number;
            /** @default true */
            visible: boolean;
            /**
             * @description YYYY; omitir o null si no se conoce
             * @example 2021
             */
            year?: string | null;
        };
        UpdateCuratedProfileDto: {
            /**
             * @default #1A365D
             * @example #5B2C87
             */
            accentColor: string;
            /** @description Obligatorio si visibility = PROTECTED */
            accessToken?: string | null;
            description?: components["schemas"]["LocalizedTextDto"] | null;
            /** @default [] */
            excludeIds: string[];
            /** @default [] */
            filterTags: string[];
            /** @description Titular propio del perfil. Omitido o vacío, el hero muestra el titular del perfil base (add-profile-content-admin, D7). */
            headline?: components["schemas"]["LocalizedTextDto"];
            /** @default [] */
            includeIds: string[];
            /** @default classic */
            layout: string;
            roleType?: components["schemas"]["LocalizedTextDto"] | null;
            /** @default [] */
            sectionsHidden: components["schemas"]["SectionId"][];
            /** @default [] */
            sectionsOrder: components["schemas"]["SectionId"][];
            /**
             * @description kebab-case, único
             * @example qa-lead
             */
            slug?: string;
            /** @example .NET */
            techFocus?: string | null;
            /** @description Id de Theme existente */
            themeId?: string | null;
            themeOverrides?: {
                [key: string]: unknown;
            } | null;
            title?: components["schemas"]["LocalizedTextDto"];
            /**
             * @default PUBLIC
             * @enum {string}
             */
            visibility: "PUBLIC" | "PRIVATE" | "PROTECTED";
        };
        UpdateEducationDto: {
            degree?: components["schemas"]["LocalizedTextDto"];
            /**
             * @description YYYY-MM o YYYY; omitir o null si está en curso
             * @example 2021-04
             */
            endDate?: string | null;
            /** @default false */
            inProgress: boolean;
            /** @example UAGRM School of Engineering */
            institution?: string;
            /** @default 0 */
            order: number;
            /**
             * @description YYYY-MM o YYYY
             * @example 2024-02
             */
            startDate?: string;
            /** @default true */
            visible: boolean;
        };
        UpdateExperienceDto: {
            /** @example ACME Corp */
            company?: string;
            /** @default false */
            current: boolean;
            /**
             * @description YYYY-MM; omitir o null si es actual
             * @example 2025-12
             */
            endDate?: string | null;
            highlights?: components["schemas"]["LocalizedListDto"];
            /** @example Santa Cruz, Bolivia · Remoto */
            location?: string;
            /** @default 0 */
            order: number;
            role?: components["schemas"]["LocalizedTextDto"];
            /** @default [] */
            sector: string[];
            /**
             * @description YYYY-MM
             * @example 2025-01
             */
            startDate?: string;
            summary?: components["schemas"]["LocalizedTextDto"];
            /**
             * @description Tags para el filtrado de perfiles curados
             * @default []
             */
            tags: string[];
            /** @default [] */
            technologies: string[];
            /** @default true */
            visible: boolean;
        };
        UpdateLanguageDto: {
            detail?: components["schemas"]["LocalizedTextDto"] | null;
            /** @example B2 */
            level?: string;
            /**
             * @description Nombre canónico; fallback de nameI18n
             * @example Inglés
             */
            name?: string;
            nameI18n?: components["schemas"]["LocalizedTextDto"] | null;
        };
        UpdateProjectDto: {
            /** @example Portafolio Web Administrable */
            name?: string;
            /** @default 0 */
            order: number;
            /** @example 2026 */
            period?: string;
            role?: components["schemas"]["LocalizedTextDto"];
            summary?: components["schemas"]["LocalizedTextDto"];
            /**
             * @description Tags para el filtrado de perfiles curados
             * @default []
             */
            tags: string[];
            /** @default [] */
            technologies: string[];
            /**
             * @description URL http(s) absoluta; null para quitarla
             * @example https://github.com/manu/portafolio
             */
            url?: string | null;
            /** @default true */
            visible: boolean;
        };
        UpdateSkillCategoryDto: {
            name?: components["schemas"]["LocalizedTextDto"];
            /** @default 0 */
            order: number;
        };
        UpdateSkillDto: {
            /** @description Mover a otra categoría */
            categoryId?: string;
            /** @example Kafka Streams */
            name?: string;
            /** @default 0 */
            order: number;
            /**
             * @description Tags para el filtrado
             * @default []
             */
            tags: string[];
        };
        UpdateSocialLinkDto: {
            /** @description null para quitarla */
            description?: components["schemas"]["LocalizedTextDto"] | null;
            /** @default false */
            featured: boolean;
            /** @example manuXD270516 */
            handle?: string;
            label?: components["schemas"]["LocalizedTextDto"];
            /** @default 0 */
            order: number;
            /**
             * @description Minúsculas, dígitos y guiones
             * @example github
             */
            platform?: string;
            /**
             * @description Objeto JSON libre; null para quitarlo. Arrays y primitivos → 400
             * @example {
             *       "repos": 67,
             *       "achievements": [
             *         "Pull Shark"
             *       ]
             *     }
             */
            stats?: {
                [key: string]: unknown;
            } | null;
            /**
             * @description URL http(s) absoluta
             * @example https://github.com/manuXD270516
             */
            url?: string;
            /** @default true */
            visible: boolean;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    AdminAnalyticsController_views: {
        parameters: {
            query?: {
                /** @description ISO 8601; default: hace 30 días. Una fecha sin hora empieza a su medianoche UTC */
                from?: string;
                /** @description ISO 8601; default: ahora. El rango es cerrado: una fecha sin hora incluye ese día completo */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileViewsResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCertificationController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCertificationResponse"][];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCertificationController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCertificationDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCertificationResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCertificationController_find: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCertificationResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCertificationController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCertificationController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCertificationDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCertificationResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCuratedProfileController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCuratedProfileResponse"][];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCuratedProfileController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCuratedProfileDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCuratedProfileResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Slug ya existe */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCuratedProfileController_find: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCuratedProfileResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCuratedProfileController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCuratedProfileController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCuratedProfileDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCuratedProfileResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminCuratedProfileController_previewDraft: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreviewCuratedProfileDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CuratedProfileResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminEducationController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminEducationResponse"][];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminEducationController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateEducationDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminEducationResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminEducationController_find: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminEducationResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminEducationController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminEducationController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateEducationDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminEducationResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminExperienceController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminExperienceResponse"][];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminExperienceController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateExperienceDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminExperienceResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminExperienceController_find: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminExperienceResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminExperienceController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminExperienceController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateExperienceDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminExperienceResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminLanguageController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminLanguageResponse"][];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminLanguageController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateLanguageDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminLanguageResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description No hay perfil cargado */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminLanguageController_find: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminLanguageResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminLanguageController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminLanguageController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateLanguageDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminLanguageResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminProfileController_find: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProfileResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description No hay perfil cargado */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminProfileController_update: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReplaceProfileDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProfileResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description No hay perfil cargado */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminProfileController_previewDraft: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreviewProfileDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminProjectController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProjectResponse"][];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminProjectController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProjectDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProjectResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminProjectController_find: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProjectResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminProjectController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminProjectController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProjectDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProjectResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSkillController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSkillCategoryResponse"][];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSkillController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateSkillCategoryDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSkillCategoryResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSkillController_addSkill: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                categoryId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateSkillDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSkillResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Categoría inexistente */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSkillController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSkillController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateSkillCategoryDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSkillCategoryResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSkillController_removeSkill: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSkillController_editSkill: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateSkillDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSkillResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSocialLinkController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSocialLinkResponse"][];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSocialLinkController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateSocialLinkDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSocialLinkResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSocialLinkController_find: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSocialLinkResponse"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSocialLinkController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminSocialLinkController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateSocialLinkDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSocialLinkResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Sin Bearer válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AdminThemeController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ThemeResponse"][];
                };
            };
            /** @description Sin sesión válida */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AuthController_doLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            /** @description Cuerpo inválido */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Credenciales incorrectas */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Demasiados intentos */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    AuthController_doLogout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cookie borrada */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AuthController_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminResponse"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    EducationController_certifications: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CertificationResponse"][];
                };
            };
        };
    };
    CuratedProfileController_list: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CuratedProfileSummaryResponse"][];
                };
            };
        };
    };
    CuratedProfileController_findBySlug: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
                /** @description Token de acceso para perfiles PROTECTED (alternativa al header `X-Access-Token`, que tiene prioridad). */
                token?: string;
            };
            header?: {
                /** @description Token de acceso para perfiles PROTECTED (prioridad sobre `?token=`). */
                "X-Access-Token"?: string;
            };
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CuratedProfileResponse"];
                };
            };
            /** @description PROTECTED sin token válido */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description Slug inexistente o perfil PRIVATE */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    EducationController_education: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EducationResponse"][];
                };
            };
        };
    };
    ExperienceController_list: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperienceResponse"][];
                };
            };
        };
    };
    ExperienceController_findById: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path: {
                /** @description Id de la experiencia */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperienceResponse"];
                };
            };
            /** @description No existe o no es visible */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    ProfileController_find: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileResponse"];
                };
            };
            /** @description No hay perfil cargado */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    ProjectController_list: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectResponse"][];
                };
            };
        };
    };
    ProfileHeadController_head: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
                /** @description Slug del perfil curado */
                slug?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Fragmento HTML para insertar dentro de <head> */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    SocialLinkController_list: {
        parameters: {
            query?: {
                /** @description Alias de `locale`. */
                lang?: "es" | "en";
                /** @description Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`). */
                locale?: "es" | "en";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Locale servido */
                    "Content-Language"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SocialLinkResponse"][];
                };
            };
        };
    };
}
