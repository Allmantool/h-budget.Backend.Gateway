# Code Review Checklist

Use this checklist for pull requests and Codex-generated changes.

## Correctness

- The change solves the stated problem without unrelated behavior changes.
- Edge cases and failure paths are handled.
- Public contracts are unchanged unless intentionally documented.

## Design

- Responsibilities are cohesive and assigned to the right type or module.
- SOLID, GRASP, KISS, YAGNI, DRY, and Law of Demeter concerns were considered.
- Dependencies are explicit and testable.
- No broad rewrite or speculative abstraction was introduced.

## Organization

- One top-level type per file where practical.
- File names match main type names.
- File, class, method, and constructor sizes are reasonable.
- Method and constructor parameter counts are reasonable or intentionally justified.
- Names are clear and domain-specific.

## Runtime Practices

- Async code avoids `.Result`, `.Wait()`, and sync-over-async.
- Cancellation tokens are accepted and propagated for I/O where practical.
- Logging is structured and does not expose secrets or sensitive data.
- Security, authorization, tracing, correlation, retries, and timeouts are preserved where relevant.

## Validation

- Tests were added or updated for changed behavior where practical.
- Existing tests pass, or failures are clearly identified as pre-existing.
- `dotnet format --verify-no-changes` was run when practical.
- `dotnet build` and `dotnet test` were run when practical.
- Analyzer/linter findings are fixed or explicitly deferred.
