# Repository Codex Instructions

These instructions apply to this repository. Follow them together with the global Codex instructions, and prefer the more specific repository guidance when there is overlap.

## Project Context

This is a C#/.NET backend gateway solution. The repository already uses central package management, StyleCop.Analyzers, SonarAnalyzer.CSharp, GitHub Actions CI, CodeQL, Serilog, OpenTelemetry, and Sentry. Keep changes consistent with that ecosystem.

## Engineering Priorities

Use this priority order when making trade-offs:

1. Correctness.
2. Simplicity.
3. Readability.
4. Maintainability.
5. Testability.
6. Performance only where needed and measured.

## Core Principles

- Apply SOLID, GRASP, KISS, YAGNI, DRY, Clean Code, and the Law of Demeter pragmatically.
- Prefer composition over inheritance.
- Keep dependencies explicit through constructors, method parameters, or framework-supported dependency injection.
- Keep units small, cohesive, and named after the domain behavior they own.
- Avoid unnecessary abstractions, speculative extension points, broad rewrites, and unrelated refactors.
- Preserve public behavior and public contracts unless the task explicitly requires a change.
- Separate domain or policy decisions from transport, infrastructure, persistence, and framework plumbing where the existing architecture supports it.

## File and Type Rules

- Prefer one top-level class, record, interface, enum, or exception per file.
- File names should match the main top-level type.
- Keep related but separate responsibilities in separate files.
- Avoid large "god files" and mixed-responsibility classes.
- Use feature/domain-based folders when the existing project structure supports it.

Guidance limits:

- Target file size: under 150 lines.
- Soft maximum file size: 250 lines.
- Target method size: under 30 lines.
- Soft maximum method size: 50 lines.
- Maximum nesting depth: 3.

These are review signals, not blind mechanical rules. If exceeding a limit is the simplest safe option, explain why in the final response.

## Method and Constructor Parameters

- Preferred maximum method parameters: 4.
- Soft maximum method parameters: 5.
- Preferred maximum constructor parameters: 5.
- Soft maximum constructor parameters: 7.

When a signature exceeds these limits, consider a request, command, options, context, value, or domain-specific parameter object. Do not create meaningless parameter bags only to satisfy a number.

## Static Classes and Extension Methods

Static classes are reasonable for:

- Pure helper methods.
- Extension methods.
- Mapping helpers.
- Constants grouped by a domain concept.

Do not use static classes for:

- Business workflows with dependencies.
- I/O.
- Logging.
- Configuration-dependent behavior.
- Mutable shared state.

Extension methods must improve readability and must not hide expensive side effects.

## C# and .NET Practices

- Respect nullable reference types and improve null-safety incrementally.
- Async methods that perform I/O should accept and pass `CancellationToken` where the calling contract allows it.
- Do not use `.Result`, `.Wait()`, or sync-over-async patterns.
- Use structured logging templates, not string interpolation, for log events.
- Do not log secrets, credentials, tokens, personal data, or sensitive business data.
- Preserve correlation, tracing, timeout, retry, and cancellation behavior where already present.
- Prefer sealed classes when inheritance is not intended.
- Prefer records for immutable data carriers.
- Prefer clear domain names over vague names such as `Manager`, `Helper`, `Processor`, or `Util`.
- Avoid large LINQ expressions when straightforward statements are easier to read.
- For EF Core code, keep queries translatable and avoid accidental client evaluation.

## Refactoring Rules

- Preserve behavior unless explicitly asked to change it.
- Keep diffs incremental, focused, and reviewable.
- Prefer extracting private methods before introducing new services.
- Extract classes or services only when they reduce real complexity, coupling, or duplication.
- Do not combine broad formatting-only changes with behavioral changes.
- Do not change public APIs unless required by the task.
- Add or update tests for changed behavior where practical.
- Explain trade-offs and any intentional deviations in the final response.

## Definition of Done

The final response for non-trivial work must include:

- What changed.
- Why the design or configuration was chosen.
- What checks were run.
- Any checks that could not be run.
- Any intentional deviations from these standards.
