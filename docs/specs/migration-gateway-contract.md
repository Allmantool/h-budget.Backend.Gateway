# Migration Gateway contract

## Status

In Progress

## Contract

The Gateway exposes GET-only identity/capability metadata and explicit Accounting routes. It forwards `Idempotency-Key`, authorization, tracing, and correlation headers unchanged. It never generates migration identity.

Capability flags describe proven downstream guarantees, not route existence. Reference resources become migration-safe only after keyed create/replay/conflict/concurrency tests pass. Transfers become safe only after atomic parent-plus-two-child acceptance, unified lifecycle, exact-side readback, and failure/restart tests pass.

## Required routes

- Account/category/contractor POST and GET-by-ID.
- Payment POST, command status GET, and history GET/query/by-ID.
- Transfer POST, unified status GET, and two-side readback GET.

Explicit Accounting routes retain higher Ocelot priority than generic Rates routes.

## Deployment rule

The local capability document must remain conservative until Accounting tests prove each guarantee and the matching Gateway routes exist. Production deployment and the Family Pro import are separate operations.
