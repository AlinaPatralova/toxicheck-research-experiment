# ToxiCheck Research Experiment

Standalone Flat/Hybrid research prototype. This repository is not a fork, remote,
deployment, or backend client of the production ToxiCheck repository.

## Run Locally

Use Node.js 24 (tested version in `.nvmrc`) and npm 11 or newer.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the printed URL. Both `/` and `/research` open the experiment. Product routes
are not mounted. Local-only use needs no backend, account, database, or environment variables.
The existing Montserrat web-font request remains unchanged to preserve appearance.

## Validate

```sh
npm run check
```

This runs publishable-file secret checks, non-mutating repository-wide lint, all tests,
type-check/build, and a built-artifact isolation check. Run `git init -b main` first
if working from a source ZIP without Git metadata.

`npm run lint:legacy` separately audits the retained, inactive product screens.
Those files and their dependencies are preserved, not refactored or bundled in
the research application. Research source, scenarios, metrics, and logging were
copied unchanged during extraction.

Direct dependencies are pinned to the versions installed in the working prototype,
including Vue 3.6.0-rc.11 and Vue Router 5.4.0. The old lockfile lagged behind that
working installation; the research lockfile was regenerated to match those direct
versions. The existing Vue release candidate is retained, not silently replaced.

## Repository And Deployment

- [Connect a new GitHub repository](docs/GITHUB_SETUP.md)
- [Create a separate deployment](docs/DEPLOYMENT.md)
- [Enable central collection with Supabase](docs/CENTRAL_COLLECTION.md)
- [Experiment freeze and change policy](docs/EXPERIMENT_FREEZE.md)
- [Security and participant data](SECURITY.md)
- [Preparation audit](docs/PREPARATION_AUDIT.md)

`main` is the stable experiment. `dev` is for changes before freeze. Publish only
to a newly created `toxicheck-research-experiment` repository. Never add a production
remote or import a production deployment's account-link directory or environment.

Participant sessions, attempts, and raw events remain in the browser's localStorage.
With central collection disabled, they are not uploaded. The optional research API
backs up one JSON row per participant in a separate Supabase project; see the setup
guide above. Exports belong outside Git. Each origin and
browser has separate storage; changing domains or using preview URLs changes the
local participant/session context. Export data before clearing browser storage.

Existing limitation: a full reload does not restore an unfinished profile. Repository
preparation does not change this behavior or any experiment measure.
