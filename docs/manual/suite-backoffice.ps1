# Suite de regresion manual del backoffice - casos TC-12 a TC-20 de docs/MANUAL.md
#
# Ejecuta cada caso contra la API, imprime el resultado real junto al esperado
# y borra todos los datos de prueba que crea, pase o falle.
#
# Corre contra la BASE DE EJEMPLO (`portfolio_example`, sembrada con `npm run seed:example`) y su API
# de ejemplo, NUNCA contra la del owner: crea y borra datos y cada llamada publica suma visitas.
# No depende de los conteos de la base, pero se niega a correr si la API no sirve el perfil ficticio
# de docs/examples/cv-data.example.json (codigo 2).
#
#   cd docs/manual
#   $env:SUITE_ADMIN_EMAIL = 'capture@example.com'; $env:SUITE_ADMIN_PASSWORD = '<contraseña de prueba>'
#   pwsh ./suite-backoffice.ps1                         # API de ejemplo en http://localhost:3310
#   pwsh ./suite-backoffice.ps1 -Api http://localhost:3310
#
# El administrador de prueba se crea con `npm run admin:bootstrap` en la base de ejemplo, con una
# contraseña aleatoria de la sesion (no se guarda en ningun archivo).
# Los defectos D-01 y D-02 que encontro esta suite estan corregidos: ver docs/MANUAL.md § 6.1.
param([string]$Api = 'http://localhost:3310')
$ErrorActionPreference = 'Stop'
$API = $Api.TrimEnd('/')

function Code($method, $url, $headers, $body) {
  try {
    $p = @{ Uri = $url; Method = $method; UseBasicParsing = $true }
    if ($headers) { $p.Headers = $headers }
    if ($body) { $p.Body = $body; $p.ContentType = 'application/json' }
    (Invoke-WebRequest @p).StatusCode
  } catch { $_.Exception.Response.StatusCode.value__ }
}
function J($method, $url, $headers, $body) {
  $p = @{ Uri = $url; Method = $method }
  if ($headers) { $p.Headers = $headers }
  if ($body) { $p.Body = $body; $p.ContentType = 'application/json' }
  Invoke-RestMethod @p
}

# Guarda: la API tiene que servir el perfil ficticio del ejemplo (nunca el del owner).
$ejemplo = (Get-Content (Join-Path $PSScriptRoot '..\examples\cv-data.example.json') -Raw -Encoding UTF8 | ConvertFrom-Json).profile.fullName
$servido = (J GET "$API/api/profile" $null $null).fullName
if ($servido -ne $ejemplo) {
  [Console]::Error.WriteLine("La API de $API sirve el perfil '$servido', no el del archivo de ejemplo ('$ejemplo'). No se ejecuto nada.")
  exit 2
}
$em = $env:SUITE_ADMIN_EMAIL
$pw = $env:SUITE_ADMIN_PASSWORD
if (-not $em -or -not $pw) { [Console]::Error.WriteLine('Faltan SUITE_ADMIN_EMAIL y SUITE_ADMIN_PASSWORD (administrador de prueba de la base de ejemplo).'); exit 1 }
$tok = (J POST "$API/api/auth/login" $null (@{email=$em;password=$pw}|ConvertTo-Json)).accessToken
$H = @{ Authorization = "Bearer $tok" }

$created = @{ profiles=@(); experiences=@(); categories=@() }

try {
# ───────────────────────── TC-12 ─────────────────────────
"## TC-12 - Crear un perfil curado"
$body = @{
  slug='suite-demo'; title=@{es='Demo de la suite';en='Suite demo'}
  headline=@{es='Perfil de prueba';en='Test profile'}
  roleType=@{es='Demo';en='Demo'}; techFocus='Demo'; visibility='PRIVATE'
} | ConvertTo-Json -Depth 5
$p = J POST "$API/api/admin/curated-profiles" $H $body
$created.profiles += $p.id
"  POST /api/admin/curated-profiles            -> 201  id=$($p.id) slug=$($p.slug) visibility=$($p.visibility)"
"  valores por defecto: layout=$($p.layout) views=$($p.views) filterTags=[$($p.filterTags -join ',')]"
$c = Code POST "$API/api/admin/curated-profiles" $H $body
"  POST con el mismo slug                      -> $c  (esperado 409)"
$c = Code POST "$API/api/admin/curated-profiles" $H (@{slug='x';title=@{es='a';en='a'};headline=@{es='a';en='a'};campoInventado='x'}|ConvertTo-Json -Depth 5)
"  POST con un campo fuera del DTO             -> $c  (esperado 400)"
# `accentColor` se retiro (retire-accent-color): se manda a proposito para comprobar que la API lo rechaza.
$c = Code POST "$API/api/admin/curated-profiles" $H (@{slug='x';title=@{es='a';en='a'};accentColor='#5B2C87'}|ConvertTo-Json -Depth 5)
"  POST con accentColor (retirado)             -> $c  (esperado 400)"
$c = Code POST "$API/api/admin/curated-profiles" $H (@{slug='x';headline=@{es='a';en='a'}}|ConvertTo-Json -Depth 5)
"  POST omitiendo 'title' (obligatorio)        -> $c  (esperado 400)"
$c = Code POST "$API/api/admin/experiences" $H (@{company='X';location='Y';role=@{es='a';en='a'};startDate='2025-01'}|ConvertTo-Json -Depth 5)
"  POST experiencia omitiendo 'summary'        -> $c  (esperado 400)"
""

# ───────────────────────── TC-19 ─────────────────────────
"## TC-19 - Mantener experiencias"
$exVis = J POST "$API/api/admin/experiences" $H (@{
  company='Suite Visible'; location='Santa Cruz'; role=@{es='Tech Lead';en='Tech Lead'}
  summary=@{es='Resumen de prueba';en='Test summary'}
  startDate='2025-01'; current=$true; technologies=@('.NET'); tags=@('suite-tag'); visible=$true
}|ConvertTo-Json -Depth 5)
$created.experiences += $exVis.id
"  POST experiencia visible   -> id=$($exVis.id) tags=[$($exVis.tags -join ',')] visible=$($exVis.visible)"
$exOcu = J POST "$API/api/admin/experiences" $H (@{
  company='Suite Oculta'; location='Santa Cruz'; role=@{es='Dev';en='Dev'}
  summary=@{es='Resumen oculto';en='Hidden summary'}
  startDate='2024-01'; endDate='2024-12'; technologies=@('Go'); tags=@('suite-tag'); visible=$false
}|ConvertTo-Json -Depth 5)
$created.experiences += $exOcu.id
"  POST experiencia oculta    -> id=$($exOcu.id) visible=$($exOcu.visible)"
$pub = J GET "$API/api/experiences" $null $null
"  GET /api/experiences (publico) incluye la oculta? $([bool]($pub | Where-Object { $_.id -eq $exOcu.id }))  (esperado False)"
$adm = J GET "$API/api/admin/experiences" $H $null
"  GET /api/admin/experiences incluye la oculta? $([bool]($adm | Where-Object { $_.id -eq $exOcu.id }))  (esperado True)"
""

# ───────────────────────── TC-13 ─────────────────────────
"## TC-13 - Tags y overrides"
$base = @{ title=@{es='x';en='x'}; headline=@{es='x';en='x'} }
$prev = J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ filterTags=@() })|ConvertTo-Json -Depth 5)
"  filterTags vacio                       -> $($prev.experiences.Count) experiencias (entra todo lo visible)"
$prev = J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ filterTags=@('suite-tag') })|ConvertTo-Json -Depth 5)
$soloVisible = ($prev.experiences | Where-Object { $_.company -eq 'Suite Visible' }).Count
$ocultaEntro = ($prev.experiences | Where-Object { $_.company -eq 'Suite Oculta' }).Count
"  filterTags=[suite-tag]                 -> $($prev.experiences.Count) experiencias; la visible entro=$soloVisible, la oculta entro=$ocultaEntro (esperado 1 y 0)"
$prev = J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ filterTags=@(); includeIds=@($exOcu.id) })|ConvertTo-Json -Depth 5)
$ocultaForzada = ($prev.experiences | Where-Object { $_.id -eq $exOcu.id }).Count
"  includeIds sobre una experiencia oculta -> entro=$ocultaForzada (esperado 0: includeIds no fuerza invisibles)"
$prev = J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ filterTags=@('suite-tag'); includeIds=@($exVis.id); excludeIds=@($exVis.id) })|ConvertTo-Json -Depth 5)
$ganaExclude = ($prev.experiences | Where-Object { $_.id -eq $exVis.id }).Count
"  mismo id en includeIds y excludeIds     -> entro=$ganaExclude (esperado 0: excludeIds siempre gana)"
""

# ───────────────────────── TC-14 ─────────────────────────
"## TC-14 - Ordenar y ocultar secciones"
$prev = J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ sectionsOrder=@('hero','experience'); sectionsHidden=@() })|ConvertTo-Json -Depth 5)
"  sectionsOrder=[hero,experience]        -> sections=[$($prev.sections -join ',')]"
"     (las secciones con datos omitidas del orden se agregan al final)"
$prev = J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ sectionsOrder=@('hero','skills','experience','contact'); sectionsHidden=@('skills') })|ConvertTo-Json -Depth 5)
"  con sectionsHidden=[skills]            -> sections=[$($prev.sections -join ',')] hiddenSections=[$($prev.hiddenSections -join ',')]"
""

# ───────────────────────── TC-20 ─────────────────────────
"## TC-20 - Skills y categorias"
$cat = J POST "$API/api/admin/skill-categories" $H (@{name=@{es='Suite Cat';en='Suite Cat'};order=99}|ConvertTo-Json -Depth 5)
$created.categories += $cat.id
"  POST categoria -> id=$($cat.id) nombre=$($cat.name.es)"
$sk = J POST "$API/api/admin/skill-categories/$($cat.id)/skills" $H (@{name='SuiteSkill';tags=@('suite-tag');order=1}|ConvertTo-Json -Depth 5)
"  POST skill     -> id=$($sk.id) nombre=$($sk.name) tags=[$($sk.tags -join ',')]"
$prev = J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ filterTags=@('suite-tag') })|ConvertTo-Json -Depth 5)
$catEntro = ($prev.skillCategories | Where-Object { $_.name -eq 'Suite Cat' }).Count
"  la categoria entra al perfil por el tag de su skill -> $catEntro (esperado 1)"
""

# ───────────────────────── TC-15 ─────────────────────────
"## TC-15 - Tema"
$temas = J GET "$API/api/admin/themes" $H $null
"  GET /api/admin/themes -> $($temas.Count) temas: $(($temas | ForEach-Object { $_.slug }) -join ', ')"
$upd = J PATCH "$API/api/admin/curated-profiles/$($p.id)" $H (@{themeId=$temas[0].id;themeOverrides=@{colors=@{accent='#5B2C87'}}}|ConvertTo-Json -Depth 5)
"  PATCH themeOverrides  -> accent guardado=$($upd.themeOverrides.colors.accent) (solo la diferencia, no el tema completo)"
""

# ───────────────────────── TC-17 ─────────────────────────
"## TC-17 - El preview no persiste"
$antes = (J GET "$API/api/admin/curated-profiles/$($p.id)" $H $null)
J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ filterTags=@('dotnet'); layout='sidebar' })|ConvertTo-Json -Depth 5) | Out-Null
$despues = (J GET "$API/api/admin/curated-profiles/$($p.id)" $H $null)
"  layout antes=$($antes.layout) despues de previsualizar con sidebar=$($despues.layout) (esperado: igual)"
"  filterTags antes=[$($antes.filterTags -join ',')] despues=[$($despues.filterTags -join ',')] (esperado: igual)"
""

# ───────────────────────── TC-16 ─────────────────────────
"## TC-16 - Visibilidad"
J PATCH "$API/api/admin/curated-profiles/$($p.id)" $H (@{visibility='PUBLIC'}|ConvertTo-Json) | Out-Null
"  PUBLIC    sin token -> $(Code GET "$API/api/curated-profiles/suite-demo" $null $null)  (esperado 200)"
J PATCH "$API/api/admin/curated-profiles/$($p.id)" $H (@{visibility='PROTECTED';accessToken='suite-token-99'}|ConvertTo-Json) | Out-Null
"  PROTECTED sin token -> $(Code GET "$API/api/curated-profiles/suite-demo" $null $null)  (esperado 401)"
"  PROTECTED con token -> $(Code GET "$API/api/curated-profiles/suite-demo?token=suite-token-99" $null $null)  (esperado 200)"
J PATCH "$API/api/admin/curated-profiles/$($p.id)" $H (@{visibility='PRIVATE'}|ConvertTo-Json) | Out-Null
"  PRIVATE   sin token -> $(Code GET "$API/api/curated-profiles/suite-demo" $null $null)  (esperado 404)"
"  PRIVATE   con token -> $(Code GET "$API/api/curated-profiles/suite-demo?token=suite-token-99" $null $null)  (esperado 404: no revela que existe)"
"  inexistente         -> $(Code GET "$API/api/curated-profiles/no-existe-jamas" $null $null)  (esperado 404: indistinguible del PRIVATE)"
$sm = (Invoke-WebRequest -Uri "$API/sitemap.xml" -UseBasicParsing).Content
"  el PRIVATE figura en el sitemap? $($sm -match 'suite-demo')  (esperado False)"
""

# ───────────────────────── TC-18 ─────────────────────────
"## TC-18 - Analitica"
J PATCH "$API/api/admin/curated-profiles/$($p.id)" $H (@{visibility='PUBLIC'}|ConvertTo-Json) | Out-Null
$v0 = (J GET "$API/api/admin/curated-profiles/$($p.id)" $H $null).views
J GET "$API/api/curated-profiles/suite-demo" $null $null | Out-Null
J GET "$API/api/curated-profiles/suite-demo?lang=en" $null $null | Out-Null
Start-Sleep -Milliseconds 400
$v1 = (J GET "$API/api/admin/curated-profiles/$($p.id)" $H $null).views
"  views antes=$v0, tras 2 visitas publicas=$v1  (esperado +2)"
J POST "$API/api/admin/curated-profiles/preview" $H (($base + @{ filterTags=@() })|ConvertTo-Json -Depth 5) | Out-Null
Start-Sleep -Milliseconds 300
$v2 = (J GET "$API/api/admin/curated-profiles/$($p.id)" $H $null).views
"  tras un preview del panel=$v2  (esperado: igual que $v1, el preview no cuenta visitas)"
$hoy = (Get-Date).ToString('yyyy-MM-dd')
$an = J GET "$API/api/admin/analytics/views?from=$hoy&to=$hoy" $H $null
$fila = $an.byProfile | Where-Object { $_.slug -eq 'suite-demo' }
"  GET analytics/views del dia -> total=$($an.total); suite-demo=$($fila.views); idiomas=$(($an.byLocale | ForEach-Object { "$($_.locale):$($_.views)" }) -join ' ')"
""
}
finally {
  "## Limpieza"
  foreach ($id in $created.profiles)    { try { J DELETE "$API/api/admin/curated-profiles/$id" $H $null | Out-Null; "  perfil $id borrado" } catch { "  perfil $id NO borrado: $($_.Exception.Message)" } }
  foreach ($id in $created.experiences) { try { J DELETE "$API/api/admin/experiences/$id" $H $null | Out-Null; "  experiencia $id borrada" } catch { "  experiencia $id NO borrada" } }
  foreach ($id in $created.categories)  { try { J DELETE "$API/api/admin/skill-categories/$id" $H $null | Out-Null; "  categoria $id borrada (y sus skills)" } catch { "  categoria $id NO borrada" } }
  $n = (J GET "$API/api/admin/curated-profiles" $H $null).Count
  $m = (J GET "$API/api/admin/experiences" $H $null).Count
  "  estado final: $n perfiles, $m experiencias"
}
