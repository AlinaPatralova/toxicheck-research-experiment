# New GitHub Repository

The research origin is configured as:

`https://github.com/AlinaPatralova/toxicheck-research-experiment.git`

The initial commit and `main`/`dev` branches are prepared locally. Remote publication
still requires GitHub authorization. Do not add origin again in this working copy.
The source copy had no Git metadata/history; no production history is imported.

If Windows reports different ownership of this Codex-created directory, trust only
this exact repository for the current PowerShell session, not all directories:

```powershell
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'safe.directory'
$env:GIT_CONFIG_VALUE_0 = (Get-Location).Path
```

After GitHub access is available, verify the origin URL and the remote heads, then
publish only this repository without force pushing:

```sh
git remote -v
git ls-remote --heads origin
git push -u origin main
git push -u origin dev
```

If the new remote already contains commits, stop and review them. Do not force push.

## Bootstrap Reference For A Fresh Copy

The steps below document the original setup process. Do not repeat `remote add`,
the initial commit, or `switch -c dev` if they already exist in the working copy.

Prerequisite for npm commands: Node.js 24 with npm 11+ must be on your terminal PATH.
The preparation environment used a separate local npm runtime; it did not install
npm globally or change the machine's global Git/Node configuration.

1. Create a new, preferably private GitHub repository named
   `toxicheck-research-experiment`. Do not fork production. Leave README, license,
   and gitignore initialization unchecked so the remote is empty.
2. Open a terminal in this project's directory, not in the original frontend.
3. Replace `OWNER` below with your GitHub account/organization. Do not use the
   production repository URL. Authentication stays in Git's normal credential
   manager/browser flow, never in a URL or project file.

```sh
git status --short --branch
git remote -v
git remote add origin https://github.com/OWNER/toxicheck-research-experiment.git
git remote get-url origin
git remote get-url --push origin
git ls-remote --heads origin
npm ci
npm run check
git add .
git diff --cached --stat
git diff --cached --check
git commit -m "Initial standalone research experiment"
git push -u origin main
git switch -c dev
git push -u origin dev
```

Stop before committing/pushing if origin is not exactly the newly created research
repository, or if it is not empty. Do not use force push or `--allow-unrelated-histories`.
If Git requests an author identity, configure it for this repository only:

```sh
git config user.name "Your Name"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
```

The separate commands above intentionally require manual review of origin before
the push. No script in this project pushes or merges automatically.

After first CI succeeds, protect `main`: require pull requests and the
`research-checks` check, disallow force push and branch deletion. Availability of
rules depends on GitHub plan/repository visibility. Use `dev` for subsequent work;
merge reviewed `dev` changes into `main` before the experiment freeze.

References: [GitHub branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches).
