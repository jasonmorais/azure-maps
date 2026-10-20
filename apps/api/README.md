# Geolocation API

Azure Functions exposes one GraphQL query. With a valid `x-forwarded-for` IP, it returns the country from Azure Maps.

```graphql
query {
  health {
    status
    ip
    countryCode
  }
}
```

## Local

1. Install Node.js `22.22.2`, pnpm, Azure Functions Core Tools v4, and Azurite; run `pnpm install`.
2. Copy `local.settings.json.example` to `local.settings.json` and set `AZURE_MAPS_CLIENT_ID` to the ID shown on your Azure Maps account.
3. Run `az login` with an identity assigned **Azure Maps Data Reader**, start Azurite, then run `pnpm run dev`.
4. POST `{"query":"{ health { status ip countryCode } }"}` to `http://localhost:7071/api/graphql` with a Functions key.

`DefaultAzureCredential` uses Azure CLI locally and managed identity in Azure. No valid forwarded IP means `ip` and `countryCode` are `null`; geolocation is approximate.

## Azure

Create a Node.js 22, Functions v4 app with storage. Enable its system-assigned managed identity, assign **Azure Maps Data Reader** on the Maps account, and set `AZURE_MAPS_CLIENT_ID` to that account's client ID. Deploy and call `/api/graphql` with a Functions key. Use stronger authentication for public production access.