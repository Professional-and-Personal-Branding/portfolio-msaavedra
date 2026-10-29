8.2 — Recorrido de D11 sobre la base descartable portfolio_views_check (API :3310, frontend :5183/:5184), base de ejemplo (105 visitas sintéticas HUMAN).

Hecho:
- Navegador real (el del panel de la app, UA "Claude/... Chrome/..."), sin sesión: abrir `/` y `/ejemplo-backend` -> una fila HUMAN por carga y views +1 de cada perfil.
- Sesión del panel: login por curl (`POST /api/auth/login`, credenciales aleatorias del administrador de prueba, no impresas) y GET del perfil con esa cookie -> fila OWNER, views igual.
- curl con UA de Googlebot, sin UA (`-H "User-Agent:"`) y con el UA por defecto de curl -> filas BOT.
- print:check (HeadlessChrome) -> filas BOT (ver 8.1).
- Agregado de la API con los tres tipos: api-agregado.txt (primera pasada, base con ruido de las pruebas de 8.1) y api-agregado-final.txt (base de ejemplo regenerada para la captura: total de personas 105 + 1, OWNER 2, BOT 2).
- views de cada perfil == filas HUMAN de ese perfil: views-por-perfil.txt.
- dashboard-ejemplo.jpg: el dashboard real (captura de manual:capture, tc18-dashboard) con "Por tipo".

Desvío: la sesión del panel en un NAVEGADOR no se hizo por interfaz (la contraseña del administrador de prueba no se escribe en un navegador): la fila OWNER se comprobó con la cookie emitida por el login real vía curl, que es la misma ruta que recorre el navegador.
