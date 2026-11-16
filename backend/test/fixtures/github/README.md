# Fixtures de GitHub (ficticios)

Respuestas inventadas para el transporte de fixtures (`GITHUB_TRANSPORT=fixture`, change `add-github-code-evidence`). Cuenta ficticia: `portafolio-ejemplo-ficticio`. Ningun archivo contiene un token ni datos reales; el escaneo de `architecture.spec.ts` lo verifica.

- `<owner>/<repo>/repo.json` y `languages.json`: lo que respondería `GET /repos/{owner}/{repo}` y `/languages`.
- Casos por nombre de repositorio (con cualquier dueño): `rate-limited`, `secondary-limit`, `forbidden` (se arman en codigo), `moved` (full_name distinto) y `private-repo` (private: true).
