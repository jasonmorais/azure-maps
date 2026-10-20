# Azure Maps IP Geolocation Sample

A minimal Azure Functions API using the Cellix bootstrap and the Azure Maps IP geolocation adapter. Its single GraphQL `health` query reports the API status, the caller IP supplied by the trusted proxy chain, and the country code resolved by Azure Maps.

```graphql
query {
	health {
		status
		ip
		countryCode
	}
}
```

Use Node.js `22.22.2` and pnpm `11.9.0`. Run `pnpm install`, then `pnpm build`. Local Azure credentials, the Functions runtime steps, and Azure Maps account/managed identity setup are documented in [apps/api/README.md](apps/api/README.md).

The copied `packages/cellix` packages are unchanged. The Azure Maps service build output is ignored under its package directory.
