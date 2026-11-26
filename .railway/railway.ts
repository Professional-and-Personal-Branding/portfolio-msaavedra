// Infraestructura de producción del portafolio en Railway, como código.
//
// Es la fuente única del entorno `production`: lo que no figura acá, el próximo
// `railway config apply` lo quita («omitting a resource means deleting it»). Se
// revisa con `railway config plan` antes de aplicar. Guía: docs/DEPLOY-RAILWAY.md.
//
// Reglas (change `migrate-railway-iac`):
//   - Ningún secreto en el archivo: JWT_SECRET y ANALYTICS_SALT van con `preserve()`;
//     su valor se carga a mano, antes del primer `plan`, y queda sellado.
//   - Ningún UUID ni dominio generado por Railway: no se declaran.
//   - Cada variable o ajuste se cambia acá, nunca solo en el panel.
//   - `.railway/railway.test.ts` comprueba que el archivo siga alineado con el repo.
import { defineRailway, github, postgres, preserve, service } from "railway/iac";

const REPO = "Professional-and-Personal-Branding/portfolio-msaavedra";
const SITE_DOMAIN = "mjsaavedra.is-a.dev";
const API_NAME = "api";
const API_PORT = 8080;
const WEB_PORT = 8080;

export default defineRailway((_ctx, project) => {
  // La versión mayor de Postgres la fija la imagen del helper (18).
  const db = postgres("Postgres");

  const api = service(API_NAME, {
    source: github(REPO, { branch: "main", checkSuites: true }),
    rootDirectory: "backend",
    build: {
      builder: "RAILPACK",
      buildCommand: "npm run prisma:generate && npm run build",
      watchPatterns: ["/backend/**"],
    },
    // Las migraciones corren en el pre-deploy, no en el arranque.
    preDeploy: "npm run prisma:deploy",
    start: "node dist/main",
    healthcheck: "/health",
    healthcheckTimeout: 300,
    deploy: {
      preDeployTimeoutSeconds: 300,
      drainingSeconds: 10,
      restartPolicyType: "ON_FAILURE",
      sleepApplication: false,
    },
    env: {
      NODE_ENV: "production",
      PORT: String(API_PORT),
      DATABASE_URL: db.env.DATABASE_URL,
      JWT_SECRET: preserve(),
      JWT_EXPIRES_IN: "1d",
      ANALYTICS_SALT: preserve(),
      SESSION_COOKIE_SAMESITE: "strict",
      LOG_LEVEL: "info",
      THROTTLE_TTL: "60",
      THROTTLE_LIMIT: "120",
      THROTTLE_LOGIN_LIMIT: "5",
      FRONTEND_URL: `https://${SITE_DOMAIN}`,
    },
  });

  const web = service("web", {
    source: github(REPO, { branch: "main", checkSuites: true }),
    rootDirectory: "frontend",
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: ["/frontend/**"],
    },
    healthcheck: "/",
    deploy: {
      restartPolicyType: "ON_FAILURE",
      sleepApplication: false,
    },
    env: {
      // Caddy escucha en {$PORT}; el dominio apunta al mismo puerto.
      PORT: String(WEB_PORT),
      API_ORIGIN: `http://${API_NAME}.railway.internal:${API_PORT}`,
    },
    domains: [{ domain: SITE_DOMAIN, port: WEB_PORT }],
  });

  return project("portfolio-msaavedra", { resources: [db, api, web] });
});
