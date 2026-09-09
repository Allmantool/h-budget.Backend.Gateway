# Gateway CI/CD Activation Ledger

This ledger separates current evidence from changes that only a repository or release owner may authorize. It must be updated with links and timestamps when each owner action is completed.

| Requirement | Current evidence | Action | Authorized executor | State |
| --- | --- | --- | --- | --- |
| Hosted candidate verification | PR #385, `tech/improve-ci-cd-v7`, SHA `107f2daa3944cda8a94bdbe9daf572a4a8ccd02e`, `Gateway PR Gate` succeeded in run `34313828062`. | Retain this as the activation PR evidence; re-run after every new commit. | CI maintainer | VERIFIED for the listed candidate |
| Required PR merge policy | `master` has no classic branch protection and no effective rulesets. | Apply the checked ruleset only after the named successful check is inspected. | Repository owner | NOT ACTIVATED |
| Required status check identity | The observed successful `Gateway PR Gate` was emitted on the activation PR, not on `master`. | Inspect using the PR head ref and use its publisher integration ID in the ruleset payload. | Repository owner | READY FOR OWNER ACTION |
| Publication hold | `GATEWAY_PUBLICATION_ENABLED` has no repository value. The local activation workflow publishes only when it equals `true`; the live `master` workflow is not yet guarded. | Leave the variable unset while the activation change is reviewed and merged; set it to `true` only after the owner has approved release recovery. | Release owner | HOLD DESIGNED; NOT ACTIVATED |
| Release recovery | The latest `Gateway Deployment` run `34282384196` failed in `Build Docker Image`; no successful sandbox recovery evidence exists. The current workflow has no isolated registry or environment input, so dispatching it would target the configured production publication path. | Provision an isolated private sandbox path before any recovery dispatch, then attach the run URL, tag SHA, digest, and smoke results. | Release owner | NOT VERIFIED |
| Credential posture | Repository secret names include Docker Hub, GitHub PAT, NuKeeper, and Sonar credentials. Values were neither read nor exposed. | Rotate/revoke according to the owner checklist and record only completion timestamps. | Credential owner | NOT VERIFIED |
| Code scanning | Open medium CodeQL alert #3: `cs/web/unvalidated-url-redirection` at `HttpsEnforcementMiddleware.cs:50` on `master`. | Triage and fix or accept with an approved risk record; do not treat a successful CodeQL workflow as closure. | Security owner | OPEN |

## Owner activation sequence

All commands below are procedures for an authorized owner; they were **not run** by this change.

1. While `master` still has the unguarded live release workflow, an explicitly authorized release owner must place a temporary publication hold before any release-affecting merge. Confirm no release mutation is in progress, disable the current workflow by its stable file name, and read back its state:

   ```powershell
   gh run list --repo Allmantool/h-budget.Backend.Gateway --status in_progress
   gh workflow disable update_semver.yml --repo Allmantool/h-budget.Backend.Gateway
   gh workflow list --repo Allmantool/h-budget.Backend.Gateway
   gh variable list --repo Allmantool/h-budget.Backend.Gateway
   ```

2. Commit and push the local activation changes to PR #385, excluding unrelated working-tree changes. Wait for a new successful `Gateway PR Gate` run on that exact candidate SHA.

3. Merge the activation PR while the temporary hold is active. The merged workflow has a default-off publication condition, so re-enabling it later cannot publish unless its variable is explicitly set to `true`.

4. Inspect the effective policy and the actual PR check publisher, then apply once after explicit repository-owner authorization:

   ```powershell
   .\tools\ci\configure-merge-protection.ps1 -Mode Inspect -Repository Allmantool/h-budget.Backend.Gateway -CheckReference tech/improve-ci-cd-v7
   .\tools\ci\configure-merge-protection.ps1 -Mode Apply -Repository Allmantool/h-budget.Backend.Gateway -CheckReference tech/improve-ci-cd-v7
   ```

5. Read back `repos/Allmantool/h-budget.Backend.Gateway/rules/branches/master`, open a new harmless PR, and prove a direct push is rejected while merging requires a fresh successful `Gateway PR Gate` check.

6. Before any recovery dispatch, provision an isolated private registry namespace and protected sandbox environment, and wire a sandbox-only workflow input or branch to those credentials. Validate that it cannot write the production image namespace or publish a GitHub Release. With a release owner and those sandbox credentials present, exercise recovery only for an existing immutable tag. Record the workflow URL, source SHA, image digest, both smoke-test outcomes, and traceability. Do not publish a new version as a test.

7. Re-enable the guarded release workflow after the ruleset and recovery prerequisites are satisfied; leave the publication variable unset. A subsequent protected merge must verify but skip the publish job:

   ```powershell
   gh workflow enable update_semver.yml --repo Allmantool/h-budget.Backend.Gateway
   ```

8. After the recovery evidence, credential rotation, and CodeQL disposition are approved, enable publication deliberately:

   ```powershell
   gh variable set GATEWAY_PUBLICATION_ENABLED --repo Allmantool/h-budget.Backend.Gateway --body true
   ```

9. Trigger a normal protected PR merge; verify that the resulting release has a draft-to-published traceability record before any production rollout.

## Publication-hold recovery

If publication must be stopped again, remove or set `GATEWAY_PUBLICATION_ENABLED` to any value other than `true`, verify no release run is in progress, and do not merge release-affecting changes until the owner has reviewed the hold. This control is deliberately fail-closed: a missing variable never enables publication.
