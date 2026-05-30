# Clean Code Review

## When To Use

Use this skill when reviewing or refactoring C#/.NET code for maintainability, readability, SOLID, GRASP, KISS, YAGNI, Law of Demeter, complexity, file size, method size, parameter count, dependency design, testability, and code-review readiness.

## Review Workflow

1. Read the changed code and nearby conventions before judging style.
2. Separate behavior risks from maintainability concerns.
3. Prefer the smallest safe fix that preserves public behavior.
4. Check tests, analyzer configuration, logging, async/cancellation flow, and dependency boundaries.
5. Avoid recommending new abstractions unless they solve current complexity, coupling, duplication, or testability problems.

## Finding Severity

Report findings by severity:

- Blocking: likely bug, security issue, broken contract, data loss risk, build/test failure, or unsafe behavior change.
- Should Fix: maintainability, reliability, testability, or readability issue that creates meaningful future cost.
- Nice to Have: low-risk cleanup, naming improvement, or small simplification.

## Finding Format

Each finding should include:

- File/symbol.
- Problem.
- Why it matters.
- Suggested fix.
- Whether the fix is safe or behavior-changing.

Lead with findings. Keep summaries brief and include test gaps or residual risks when no issues are found.

## Review Checklist

- Correctness and edge cases.
- Simple, domain-specific design.
- SOLID and GRASP responsibility assignment.
- KISS and YAGNI.
- Law of Demeter and dependency clarity.
- One top-level type per file.
- Reasonable file and method size.
- Reasonable method and constructor parameter counts.
- Async methods avoid sync-over-async and pass cancellation where possible.
- Structured logging avoids secrets and sensitive data.
- Tests cover changed behavior.
- Analyzer and formatter results are addressed or intentionally deferred.
