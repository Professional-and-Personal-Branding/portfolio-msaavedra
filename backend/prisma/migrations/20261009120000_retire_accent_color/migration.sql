-- retire-accent-color (D3, D4): el acento de cada perfil pasa al tema antes de borrar la columna.
-- Un colors.accent ya presente en themeOverrides gana: no se pisa.
UPDATE "CuratedProfile"
SET "themeOverrides" = jsonb_set(
      CASE WHEN jsonb_typeof("themeOverrides") = 'object' THEN "themeOverrides" ELSE '{}'::jsonb END,
      '{colors}',
      CASE WHEN jsonb_typeof("themeOverrides" -> 'colors') = 'object'
           THEN "themeOverrides" -> 'colors' ELSE '{}'::jsonb END
        || jsonb_build_object('accent', "accentColor"),
      true)
WHERE COALESCE(jsonb_typeof("themeOverrides" #> '{colors,accent}'), 'null') = 'null';

ALTER TABLE "CuratedProfile" DROP COLUMN "accentColor";
