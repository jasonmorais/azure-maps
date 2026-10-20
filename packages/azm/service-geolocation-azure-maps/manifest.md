# Package Manifest

## Purpose

Provide an Azure Maps IP-to-country adapter implementing `@cellix/service-geolocation-base`.

## Scope

Validate IPv4 and IPv6 input, acquire Entra tokens through Azure Identity, call the Azure Maps Geolocation REST API, and normalize the ISO country code and locally derived English country name.

## Non-goals

This package does not select the active application provider, determine proxy trust, persist lookup results, return city-level data, or manage Azure resources and role assignments.

## Public API shape

`ServiceGeolocationAzureMaps` implements the shared infrastructure service. `AzureMapsOptions` configures the Azure Maps account client ID and optional timeout. `AzureMapsTokenCredential` is an injectable credential seam for tests and custom credential chains.

## Core concepts

The Azure Maps API returns a country/region ISO code only, and the adapter returns that country code without deriving a country name. Unknown country data returns `null`; operational failures reject.

## Package boundaries

The adapter owns Azure Maps authentication, HTTP transport, input validation, and response normalization. Provider selection and request continuation policy remain outside the package.

## Dependencies / relationships

Depends on `@azure/identity` for `DefaultAzureCredential` and `@cellix/service-geolocation-base` for the provider-neutral contract.

## Testing strategy

Vitest tests import the package entrypoint and inject Fetch and credential implementations. Cover country mapping, IPv4/IPv6, authentication headers and scope, unknown data, lifecycle, validation, and provider failures.

## Documentation obligations

Keep the README aligned with Azure Maps' country-only response, local country-name derivation, Entra authentication, role assignment, endpoint, and transaction billing.

## Release-readiness standards

Build the package, pass Vitest and Biome, verify the adapter against the facade contract, and ensure no credential is sent in the URL. The package remains opt-in until the application composition root selects it.