# Standalone Repository Preparation Audit

Prepared from the current workspace on 2026-10-15.

## Publication Update: 2026-10-16

The user supplied the new GitHub repository URL. Origin now points only to
`https://github.com/AlinaPatralova/toxicheck-research-experiment.git`.
Checks were repeated successfully: secret hygiene, repository-wide lint, 22 tests,
type-check/build, and build isolation. Local initial commit and main/dev preparation
are complete. Push is pending GitHub authorization; the execution environment cannot
access the Windows credential store. No production remote was added or contacted.
The preparation sections below describe the earlier snapshot before origin existed.

## Git And Original Project

- The supplied working frontend and task folder were not Git repositories. No
  existing Git history or remotes were present to import or rewrite.
- No unseen production repository/history was inspected or changed.
- Preparation was performed in a NEW sibling directory named
  `toxicheck-research-experiment`. The original working frontend was only read/copied.
- A fresh independent `.git` was initialized with unborn `main`: zero commits,
  no remotes, no push, no merge. `dev` will be created after the initial commit.
- The requested GitHub repository does not yet exist. No initial commit/push was
  made because the user requested those after connecting the new origin.

## Source Preservation And Isolation

- All 22 files under `src/research` match the working source byte-for-byte by SHA-256.
  This includes scenarios, training data, Flat/Hybrid mechanics, gold profiles,
  assignment/counterbalancing, TCT, exact_success, logging, and storage schemas.
- All product source files are retained. The original `src/routes.ts` is preserved
  but inactive. `src/main.ts` uses the new research-only `src/researchRouter.ts`.
- Both `/` and `/research` open the experiment. Product URLs such as `/home`
  redirect to research rather than mounting product screens.
- Removed only the NEW repository's Vercel `/api` rewrite to the existing product
  backend. No deployment account/project links, domains, secrets, or integrations
  were copied. Vite devtools plugin is not loaded in the independent build.
- The output bundle isolation check found no product backend/OCR/catalog service
  references. Google Fonts remains unchanged to preserve the current UI.

## Secrets And Participant Data

- No `.env`, registry credentials, private keys, database connection strings, or
  recognizable embedded access tokens were found in the supplied application files.
- Initial source scan excluded generated dependencies/build output, not source.
- Added `.gitignore` for environment files, credential files, deployment account
  metadata, generated dependencies/builds, and participant/QA exports.
- Ignore behavior is tested for representative sensitive/generated/data paths.
- Added a redacting secret/file checker for tracked and publishable untracked files.
  It is heuristic, not a guarantee or an audit of a production history not supplied.
- No participant browser exports, existing QA screenshots, runtime caches, or logs
  were copied into the new repository.

## Reproducibility

The old lockfile did not describe the dependencies installed in the working prototype:

| Package | Old lock install | Working prototype and prepared repository |
| --- | --- | --- |
| Vue | 3.6.0-rc.5 | 3.6.0-rc.11 |
| Vue Router | 5.2.0 | 5.4.0 |
| Vite | 8.2.2 | 8.3.4 |

Direct dependencies/devDependencies were pinned to the versions actually installed
in the working prototype. The Vue package-family overrides were pinned consistently
instead of the moving `rc` tag. The new npm lockfile was regenerated, followed by a
clean `npm ci`. All direct installed versions were compared successfully against
the working source installation. This preserves that baseline, not an arbitrary
upgrade to latest packages. New transitive resolution is frozen by package-lock.json.

Validated with Node.js 24.19.0 and npm 12.2.0. npm was obtained from its official
registry with its published SHA-512 archive integrity verified. TLS verification
was not disabled. No global package installation/configuration was changed.

## Checks Completed

- `npm install`: passed.
- `npm ci`: passed on the prepared lockfile.
- `npm run check:secrets`: passed.
- `npm run lint`: Oxlint and ESLint across the repository, passed without fixes.
- Existing full-source legacy ESLint check: passed.
- `npm test`: 22 tests passed, zero failures.
- `npm run build`: type-check and Vite production build passed.
- `npm run check:isolation`: passed.
- Browser smoke test: `/`, `/research`, and product-route fallback passed; no
  warning/error console entries. No participant was started in this smoke test.

Non-blocking existing package notices: lucide-vue-next is deprecated upstream;
npm 12 blocks the unused Tesseract donation postinstall. The icon library/OCR source
was not migrated or deleted. No dependency vulnerability audit/fix is claimed.

## Not Performed Yet

- Creating the new GitHub repository, linking origin, initial commit, and first push.
- Creating/pushing dev and configuring GitHub branch protection.
- Running GitHub-hosted CI (workflow is prepared; local equivalent passed).
- Creating a separate Vercel project/domain or deploying publicly.
- Freezing/tagging the final experiment version; this requires the later explicit
  dev-to-main review and study freeze decision.

See GITHUB_SETUP.md, DEPLOYMENT.md, and EXPERIMENT_FREEZE.md for these next steps.
