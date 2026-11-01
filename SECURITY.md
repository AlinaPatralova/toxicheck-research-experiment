# Security And Data Handling

- Local-only use requires no credentials. Optional central collection requires
  server-only Supabase credentials; see [setup](docs/CENTRAL_COLLECTION.md).
- Never put secrets in client-side VITE variables: they are public build data.
- Do not commit `.env`, registry credentials, private keys, deployment account links,
  participant exports, HAR captures, or local backups. `.gitignore` excludes them.
- `npm run check:secrets` scans tracked and publishable untracked files without
  printing matched values. It is a heuristic, not a guarantee or history scanner.
- Enable GitHub secret scanning/push protection where available. Review staged
  files before the first commit. If a credential is exposed, revoke/rotate it;
  deleting a file or adding `.gitignore` does not remove prior exposure.
- Research data is retained locally and, when enabled, in the private research
  Supabase project. Individual write tokens cannot read results. Do not send exports to public
  GitHub issues, PRs, repositories, or a public deployment's static directory.
- Prefer a private source repository: scenarios and gold profiles are in source
  and should not be given to participants in advance.
- Gold profiles also exist in client JavaScript. A private source repository is
  not server-side concealment or protection against deliberate client inspection.
- Google Fonts remains an external font request. There are no production API
  rewrites or product API clients in the active research bundle.
- Original product files are retained as inactive source. Do not reactivate their
  routes or backend/OCR integrations as part of the experiment.
