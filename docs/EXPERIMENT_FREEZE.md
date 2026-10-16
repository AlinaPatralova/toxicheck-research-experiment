# Branches And Experiment Freeze

- `dev`: further UI, wording, protocol, dependency, and implementation work BEFORE freeze.
- `main`: validated stable version used by the experiment's stable deployment.
- Never merge to, push to, or deploy through the product ToxiCheck repository/project.

## Before Main Data Collection

1. Complete preliminary testing on dev previews and review protocol-sensitive changes.
2. Run `npm ci` and `npm run check`. Verify all six tasks and separate training,
   gold/actual comparison, timing boundaries, logging, exports, and mobile layout.
3. Open a PR from `dev` to `main`, wait for checks and review, then merge it.
4. Tag the approved main commit, for example:

```sh
git switch main
git pull --ff-only origin main
git tag -a experiment-v1.0.0 -m "Frozen version for main data collection"
git push origin experiment-v1.0.0
```

5. Record the tag, full commit SHA, deployment URL/ID, freeze date, and protocol
   revision in the study's controlled records. Do not change the existing event or
   attempt schema just to add this information.
6. Confirm the stable research deployment serves that exact commit. Lock/protect
   main against changes where available and record who may approve an exception.

## During Collection

Do not change interface, wording, categories, datasets, task order, timing, metrics,
logging, dependency lockfile, font loading, or deployment settings without a separate
documented methodological decision. Do not merge dev into main during the main sample.
Do not update dependencies or enable automatic merge/release tooling on the frozen
main branch. Dev previews must not be used by main-study participants.

A necessary fix requires explicit approval, documented rationale and affected
participants, a new version/tag, and a decision on separating samples. Branch names
and this document are policy, not automatic enforcement: GitHub protection and host
settings must be configured after the new remote/project exists.
