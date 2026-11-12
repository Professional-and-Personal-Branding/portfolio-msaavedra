-- Solo datos (change add-featured-repositories): los perfiles curados sembrados antes del change
-- guardan un orden explícito de nueve ids sin `repositories`, y la sección llegaría al final.
-- Se inserta justo después de `projects`. Idempotente: no toca los arreglos vacíos, los que no
-- tienen `projects` ni los que ya tienen `repositories`.
UPDATE "CuratedProfile"
SET "sectionsOrder" =
  "sectionsOrder"[1:array_position("sectionsOrder", 'projects')]
  || ARRAY['repositories']::TEXT[]
  || "sectionsOrder"[array_position("sectionsOrder", 'projects') + 1:]
WHERE 'projects' = ANY("sectionsOrder")
  AND NOT ('repositories' = ANY("sectionsOrder"));
