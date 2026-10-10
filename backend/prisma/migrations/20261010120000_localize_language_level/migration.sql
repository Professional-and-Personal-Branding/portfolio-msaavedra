-- localize-language-level (D2): el nivel de cada idioma pasa a texto bilingüe en la misma fila.
-- Nivel conocido en español -> { es, en }; código MCER -> { es: x, en: x }; cualquier otro -> { es: x }.
ALTER TABLE "Language" ALTER COLUMN "level" TYPE JSONB USING (
  CASE
    WHEN lower(btrim("level")) IN ('nativo', 'nativa', 'lengua materna', 'idioma materno')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Native')
    WHEN lower(btrim("level")) = 'bilingüe'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Bilingual')
    WHEN lower(btrim("level")) = 'principiante'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Beginner')
    WHEN lower(btrim("level")) IN ('básico', 'básica')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Basic')
    WHEN lower(btrim("level")) = 'elemental'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Elementary')
    WHEN lower(btrim("level")) IN ('intermedio', 'intermedia')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Intermediate')
    WHEN lower(btrim("level")) IN ('intermedio alto', 'intermedio-alto', 'intermedia alta', 'intermedia-alta')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Upper intermediate')
    WHEN lower(btrim("level")) IN ('avanzado', 'avanzada')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Advanced')
    WHEN lower(btrim("level")) IN ('fluido', 'fluida')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Fluent')
    WHEN lower(btrim("level")) = 'conversacional'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Conversational')
    WHEN lower(btrim("level")) = 'profesional'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Professional')
    WHEN btrim("level") ~* '^[abc][12]\+?(\s*[-/–]\s*[abc][12]\+?)?$'
      THEN jsonb_build_object('es', btrim("level"), 'en', btrim("level"))
    ELSE jsonb_build_object('es', btrim("level"))
  END
);
