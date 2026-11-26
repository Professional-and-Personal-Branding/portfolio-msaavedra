// Coherencia de `railway.ts` con el resto del repo. Sin red: el SDK arma objetos en
// memoria y acá se comparan con `backend/package.json`, el Dockerfile y el Caddyfile.
// Los mensajes nombran el campo, nunca imprimen valores (puede haber secretos cerca).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createRailwayContext, project } from "railway/iac";
import program from "./railway.ts";

type Variable = { type: string; value?: string; resource?: string; output?: string };
type Node = {
  address: string;
  type: string;
  name: string;
  image?: string;
  source?: {
    type?: string;
    branch?: string;
    checkSuites?: boolean;
    rootDirectory?: string;
  };
  build?: {
    builder?: string;
    buildCommand?: string;
    dockerfilePath?: string;
    watchPatterns?: string[];
  };
  deploy?: {
    startCommand?: string;
    preDeployCommand?: string[];
    healthcheckPath?: string;
    healthcheckTimeout?: number;
    preDeployTimeoutSeconds?: number;
    drainingSeconds?: number;
    restartPolicyType?: string;
    sleepApplication?: boolean;
  };
  networking?: { customDomains?: Record<string, { port?: number }> };
  variables?: Record<string, Variable>;
};

const root = (relative: string): string =>
  fileURLToPath(new URL(`../${relative}`, import.meta.url));
const read = (relative: string): string => readFileSync(root(relative), "utf8");

const definition = await program(createRailwayContext({ environment: "production" }), project);
const resources = definition.resources as unknown as Node[];

function recurso(address: string): Node {
  const found = resources.find((resource) => resource.address === address);
  assert.ok(found, `Falta el recurso ${address} en railway.ts`);
  return found;
}

const api = recurso("service.api");
const web = recurso("service.web");
const db = recurso("database.Postgres");
const apiVars = api.variables ?? {};
const webVars = web.variables ?? {};

const scripts = (JSON.parse(read("backend/package.json")) as { scripts: Record<string, string> })
  .scripts;
const railwayText = readFileSync(fileURLToPath(new URL("./railway.ts", import.meta.url)), "utf8");

function literal(vars: Record<string, Variable>, key: string): string {
  const variable = vars[key];
  assert.ok(
    variable?.type === "literal" && typeof variable.value === "string",
    `${key} debe ser un literal`,
  );
  return variable.value;
}

test("recursos: Postgres, api y web, y ninguno más", () => {
  assert.deepEqual(resources.map((r) => r.address).sort(), [
    "database.Postgres",
    "service.api",
    "service.web",
  ]);
});

test("fuente: rama main, Wait for CI y Root Directory", () => {
  for (const [nombre, servicio, dir] of [
    ["api", api, "backend"],
    ["web", web, "frontend"],
  ] as const) {
    assert.equal(servicio.source?.type, "github", `${nombre}: source.type`);
    assert.equal(servicio.source?.branch, "main", `${nombre}: source.branch`);
    assert.equal(servicio.source?.checkSuites, true, `${nombre}: source.checkSuites`);
    assert.equal(servicio.source?.rootDirectory, dir, `${nombre}: source.rootDirectory`);
  }
});

test("sin Config as Code (railway.json ni railway.toml)", () => {
  for (const dir of ["", "backend/", "frontend/"]) {
    for (const archivo of ["railway.json", "railway.toml"]) {
      assert.equal(existsSync(root(`${dir}${archivo}`)), false, `sobra ${dir}${archivo}`);
    }
  }
});

test("api: cada npm run existe en backend/package.json y las migraciones son migrate deploy", () => {
  const comandos = [api.build?.buildCommand ?? "", ...(api.deploy?.preDeployCommand ?? [])];
  assert.ok(comandos.every(Boolean), "api: faltan buildCommand o preDeployCommand");
  const usados = comandos
    .flatMap((c) => c.split("&&"))
    .map((c) => c.trim())
    .map((c) => /^npm run (\S+)$/.exec(c)?.[1])
    .filter((s): s is string => s !== undefined);
  assert.ok(usados.length >= 3, "api: se esperaban al menos 3 scripts npm run");
  for (const script of usados) {
    assert.ok(script in scripts, `api: el script "${script}" no existe en backend/package.json`);
  }
  assert.equal(api.build?.buildCommand, "npm run prisma:generate && npm run build");
  assert.deepEqual(api.deploy?.preDeployCommand, ["npm run prisma:deploy"]);
  assert.equal(
    scripts["prisma:deploy"],
    "prisma migrate deploy",
    "prisma:deploy debe ser migrate deploy",
  );
  assert.equal(api.build?.builder, "RAILPACK");
});

test("api: start igual a start:prod", () => {
  assert.equal(api.deploy?.startCommand, scripts["start:prod"]);
  assert.equal(api.deploy?.startCommand, "node dist/main");
});

test("api: ajustes de despliegue", () => {
  assert.equal(api.deploy?.healthcheckPath, "/health");
  assert.equal(api.deploy?.healthcheckTimeout, 300);
  assert.equal(api.deploy?.preDeployTimeoutSeconds, 300);
  assert.ok((api.deploy?.drainingSeconds ?? 0) > 8, "api: drainingSeconds debe ser mayor que 8");
  assert.equal(api.deploy?.restartPolicyType, "ON_FAILURE");
  assert.equal(api.deploy?.sleepApplication, false);
  assert.deepEqual(api.build?.watchPatterns, ["/backend/**"]);
});

test("web: Dockerfile existente, healthcheck y redeploy selectivo", () => {
  assert.equal(web.build?.builder, "DOCKERFILE");
  const dockerfile = web.build?.dockerfilePath;
  assert.ok(dockerfile, "web: falta build.dockerfilePath");
  assert.ok(existsSync(root(`frontend/${dockerfile}`)), "web: frontend/<dockerfilePath> no existe");
  assert.equal(web.deploy?.healthcheckPath, "/");
  assert.equal(web.deploy?.restartPolicyType, "ON_FAILURE");
  assert.equal(web.deploy?.sleepApplication, false);
  assert.deepEqual(web.build?.watchPatterns, ["/frontend/**"]);
});

test("web: el Caddyfile usa {$PORT} y {$API_ORIGIN}", () => {
  const caddyfile = read("frontend/Caddyfile");
  assert.ok(caddyfile.includes("{$PORT"), "Caddyfile: no usa {$PORT}");
  assert.ok(caddyfile.includes("{$API_ORIGIN}"), "Caddyfile: no usa {$API_ORIGIN}");
});

test("proxy: API_ORIGIN sale del nombre y el PORT de api", () => {
  const port = literal(apiVars, "PORT");
  assert.equal(literal(webVars, "API_ORIGIN"), `http://${api.name}.railway.internal:${port}`);
});

test("dominio: FRONTEND_URL es el origen https de un dominio de web y PORT coincide con el de sus dominios", () => {
  const dominios = Object.keys(web.networking?.customDomains ?? {});
  assert.ok(dominios.length >= 1, "web: falta el dominio propio");
  const frontendUrl = literal(apiVars, "FRONTEND_URL");
  assert.equal(new URL(frontendUrl).origin, frontendUrl, "FRONTEND_URL debe ser un origen");
  assert.ok(
    dominios.some((dominio) => frontendUrl === `https://${dominio}`),
    "FRONTEND_URL no coincide con ningún dominio de web",
  );
  for (const dominio of dominios) {
    assert.equal(
      web.networking?.customDomains?.[dominio]?.port,
      Number(literal(webVars, "PORT")),
      `web: el puerto del dominio ${dominio} y PORT difieren`,
    );
  }
});

test("base: DATABASE_URL referencia a Postgres", () => {
  const variable = apiVars["DATABASE_URL"];
  assert.equal(variable?.type, "reference", "DATABASE_URL debe ser una referencia");
  assert.equal(variable?.resource, "database.Postgres");
  assert.equal(variable?.output, "DATABASE_URL");
});

test("base: Postgres 18", () => {
  assert.ok(db.image?.endsWith(":18"), "Postgres: la imagen debe terminar en :18");
});

test("secretos: preserve() y ningún literal", () => {
  for (const clave of ["JWT_SECRET", "ANALYTICS_SALT"]) {
    assert.equal(apiVars[clave]?.type, "preserve", `${clave} debe ser preserve()`);
  }
  const secretas = [
    "JWT_SECRET",
    "ANALYTICS_SALT",
    "INTEGRATIONS_KEYS",
    "GITHUB_SYNC_TOKEN",
    "ANTHROPIC_API_KEY",
  ];
  for (const [nombre, vars] of [
    ["api", apiVars],
    ["web", webVars],
  ] as const) {
    for (const clave of secretas) {
      assert.ok(vars[clave]?.type !== "literal", `${nombre}: ${clave} no puede ser un literal`);
    }
  }
});

test("variables prohibidas en el archivo", () => {
  const prohibidas = /^(ADMIN_.*|SEED_ALLOW_PRODUCTION|ENABLE_API_DOCS|AI_EVAL_.*)$/;
  for (const [nombre, vars] of [
    ["api", apiVars],
    ["web", webVars],
  ] as const) {
    for (const clave of Object.keys(vars)) {
      assert.ok(!prohibidas.test(clave), `${nombre}: la variable ${clave} no debe figurar`);
    }
  }
});

test("texto fuente: sin UUIDs ni dominios generados", () => {
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(railwayText), "railway.ts contiene un UUID");
  assert.ok(!railwayText.includes("up.railway.app"), "railway.ts contiene un dominio up.railway.app");
});
