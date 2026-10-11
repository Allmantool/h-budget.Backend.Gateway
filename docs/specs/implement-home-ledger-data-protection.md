# Home Ledger data-protection Gateway contract

Authoritative change: root OpenSpec `implement-home-ledger-data-protection`.

## Tasks 2.1, 2.2, and 2.4 Gateway boundary

The Gateway owns the first authorization boundary for the versioned Accounting
data-protection API. Requests below `/gateway/accounting/data-protection/v1`
must authenticate, carry the `home-ledger.data-protection.admin` scope, satisfy
the named `DataProtectionAdministrator` administrator policy, and present a
recent `auth_time` before the Gateway invokes Accounting.

`DataProtectionAuthorizationTests` records the authorization contract:

| Requirement | Executable evidence |
| --- | --- |
| SEC-01 anonymous rejection | `AnonymousPlanRequestIsRejectedBeforeDownstreamInvocation` |
| SEC-01 named administrator policy | `RegistersNamedAdministratorPolicy` |
| SEC-01 missing administrator role | `CallerWithoutAdministratorRoleIsRejectedBeforeDownstreamInvocation` |
| SEC-01 recent authentication | `AdministratorWithStaleAuthenticationIsRejectedBeforeDownstreamInvocation` |

Each rejected request uses an outbound HTTP activity probe to assert that no
downstream invocation was attempted. A positive, recently authenticated case
proves the same probe records the Accounting destination. Confirmation replay
and its target, ledger generation, operation-kind, expiry, and plan-hash binding
remain owning-service checks in Accounting; the Gateway forwards, but does not
reinterpret, those confirmation fields.

The explicit priority-200 Ocelot route maps
`/gateway/accounting/data-protection/v1/{everything}` to
`/data-protection/v1/{everything}` on Accounting. It outranks the generic Rates
route and supports GET and POST. Authorization, `Idempotency-Key`,
`If-Match`, `CorrelationId`, W3C trace headers, and baggage are preserved.
Disconnect cancellation and downstream error status are propagated.

## Configuration and activation

`DataProtectionAuthorization:Enabled` defaults to `false`. While disabled, the
Gateway returns 404 for the complete administrative prefix before Ocelot can
fall through to another service. Enabling requires all of:

- an absolute `Authority` (HTTPS in Production);
- the expected `Audience`;
- the administrator role and `home-ledger.data-protection.admin` scope;
- a recent-authentication window from 1 through 3,600 seconds;
- future clock skew from 0 through 300 seconds; and
- HTTPS metadata in Production.

Enabled invalid configuration fails options validation during startup. The
`data-protection-authorization` readiness check also reports disabled, valid, or
invalid state without disclosing tokens or configuration values. Configuration
changes require a Gateway restart because JWT and policy construction is a
startup boundary.

The production bearer scheme validates issuer metadata, audience, lifetime,
expiration, and signature. Ocelot 25.0 is configured with the supported plural
`AuthenticationProviderKeys` and route scope authorization. The named ASP.NET
policy adds the administrator role and a numeric UTC `auth_time` freshness
requirement before Ocelot forwarding. Test authentication exists only in the
test assembly under the `Testing` environment.

Reference procedures:

- Ocelot 25 authentication: <https://ocelot.readthedocs.io/en/develop/features/authentication.html>
- ASP.NET Core 10 JWT bearer validation: <https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0>
- ASP.NET Core 10 policy authorization: <https://learn.microsoft.com/aspnet/core/security/authorization/policies?view=aspnetcore-10.0>

Production activation remains **BLOCKED** until an external OIDC authority,
audience, administrator-role mapping, and scope grant are provisioned and tested
end to end. This change does not activate the currently unused Identity
repository and does not invent production credentials.
