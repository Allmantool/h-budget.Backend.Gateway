# Coding Standards

This repository favors production-grade C#/.NET code that is correct, simple, readable, maintainable, and testable. Performance work should be driven by an observed need or measurement.

## Design Principles

- Apply SOLID, GRASP, KISS, YAGNI, DRY, Clean Code, and the Law of Demeter pragmatically.
- Prefer composition over inheritance.
- Use explicit dependencies and framework-supported dependency injection.
- Keep business decisions separate from transport, framework, infrastructure, persistence, and configuration code where the architecture supports it.
- Avoid speculative abstractions and broad rewrites.

## File and Type Organization

- Prefer one top-level class, record, interface, enum, or exception per file.
- File names should match the main type name.
- Keep files focused on one responsibility.
- Use feature/domain folders where the current structure supports them.
- Target files under 150 lines and methods under 30 lines.
- Treat 250-line files, 50-line methods, and nesting deeper than 3 as review signals.

## Signatures

- Prefer no more than 4 method parameters and no more than 5 constructor parameters.
- Treat 5 method parameters and 7 constructor parameters as soft maximums.
- When signatures grow, consider a request, command, options, context, value, or domain-specific parameter object.
- Do not create vague parameter bags only to satisfy a limit.

## C# and .NET

- Respect nullable reference types and improve null-safety incrementally.
- Async I/O methods should accept and propagate `CancellationToken` where the contract allows it.
- Do not use `.Result`, `.Wait()`, or sync-over-async.
- Use structured logging templates and avoid logging secrets or sensitive data.
- Prefer sealed classes when inheritance is not intended.
- Prefer records for immutable data carriers.
- Prefer clear domain names over vague names such as `Manager`, `Helper`, `Processor`, or `Util`.
- Keep LINQ readable; use statements when a query becomes hard to scan.

## Refactoring

- Preserve behavior unless a behavior change is explicitly requested.
- Keep changes focused and reviewable.
- Add or update tests for changed behavior where practical.
- Explain trade-offs, skipped checks, and intentional deviations in the final response or PR notes.
