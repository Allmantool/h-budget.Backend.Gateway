# Gateway CI/CD Activation and Delivery Ledger

This ledger records evidence separately from owner-authorized mutations. Do not infer publication, registry, or runtime delivery from a green qualification run.

## Release #540 diagnosis

| Boundary | Evidence | State |
| --- | --- | --- |
| Source qualification | Gateway Release run #540 is API run `34314742288`, event `push`, source/workflow SHA `d204e5bb1ae0e88df548d1acf2f8d96701e72ed0`. Reusable verification, CodeQL, container build, positive smoke, and invalid-configuration smoke passed. | VERIFIED |
| Publication eligibility | Repository variable `GATEWAY_PUBLICATION_ENABLED` is absent. The `Publish GitHub Release` job was consequently skipped. | HELD |
| Version analysis | From immutable tag `v0.0.796`, the reachable merge range contains `feat: improve ci / cd` and maintenance commits. The locked production commit-analyzer resolved `minor`; the next candidate is `v0.1.0`. | CANDIDATE; NOT EXECUTED |
| Tag and GitHub Release | No `v0.1.0` tag or GitHub Release exists. | ABSENT |
| Publication handoff | The skipped publish job created no tag and therefore dispatched no child work. The former asynchronous dispatch has been replaced locally by a direct reusable workflow call. | ABSENT; REPAIRED LOCALLY |
| Docker Hub | `allmantool/homebudget-backend-gateway:0.1.0` and `sha-d204e5bb1ae0e88df548d1acf2f8d96701e72ed0` return `no such manifest`. | ABSENT |
| GitHub Environment | `production` exists with no protection rules. Run #540 created no deployment record because publication never ran. The repaired workflow binds the actual Docker Hub publish job to it. | NOT VERIFIED FOR #540; REPAIRED LOCALLY |
| Runtime target | No Gateway runtime deployment mechanism, target URL, or digest-consuming rollout script is configured in this repository. | NOT CONFIGURED |

The first evidenced cause is intentional fail-closed publication control, not a semantic-release failure. The post-merge repair adds a visible HELD/READY decision, supported semantic-release decision evidence, direct delivery correlation, registry readback, and an environment delivery report.

## Owner-authorized procedure

The following commands are procedures only; they were **not run** by this change.

1. Commit only the follow-up delivery repair and open a new protected PR from the current post-merge branch. Do not include the unrelated `HomeBudget.Backend.Gateway/appsettings.json` working-tree change.
2. Require a fresh successful `Gateway PR Gate`, then merge through the master PR ruleset after the repository owner has applied it. The release range for the new source SHA includes the original `feat` and remains eligible for `v0.1.0` unless a competing immutable release is created first.
3. Inspect the sole control and all workflow states before authorizing publication:

   ```powershell
   pwsh .\tools\ci\configure-publication.ps1 -Mode Inspect -Repository Allmantool/h-budget.Backend.Gateway
   ```

4. Confirm the owner-approved registry namespace, Docker Hub credentials, CodeQL disposition, and credential-rotation disposition. The switch alone is not security approval.
5. Enable delivery explicitly, then merge or dispatch a newly validated source. Enabling does not replay Release #540:

   ```powershell
   pwsh .\tools\ci\configure-publication.ps1 -Mode Enable -Repository Allmantool/h-budget.Backend.Gateway
   ```

6. Verify the generated immutable tag, draft/final GitHub Release, both remote Docker Hub tags and common digest, `production` deployment record, and `gateway-delivery-<tag>` report. If a draft exists for the exact source SHA, use the supported recovery path; do not allocate another version.
7. Disable immediately if necessary; it fail-closes subsequent runs but does not cancel an execution already in progress:

   ```powershell
   pwsh .\tools\ci\configure-publication.ps1 -Mode Disable -Repository Allmantool/h-budget.Backend.Gateway
   ```

## Truthful outcome labels

`HELD` means no publication mutation was attempted. `NO_RELEASE` means semantic-release found no eligible commit. `PUBLISHED` requires a finalized GitHub Release, matching remote version/SHA image digest, and the `production` registry-publication deployment record. `RUNTIME DEPLOYMENT: NOT CONFIGURED` remains distinct until an owner supplies an actual target and digest-based rollout/health verification.
