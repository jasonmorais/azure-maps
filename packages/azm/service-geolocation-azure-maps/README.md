# `@ocom/service-geolocation-azure-maps`

Server-side IP-to-country adapter for Azure Maps. It implements `@cellix/service-geolocation-base` and can be selected in place of another provider without changing the application-service or integration-event flow.

Azure Maps returns an ISO country/region code. This adapter returns that country code without deriving a country name.

```ts
import { ServiceGeolocationAzureMaps } from '@ocom/service-geolocation-azure-maps';

const geolocationService = new ServiceGeolocationAzureMaps({
	clientId: process.env.AZURE_MAPS_ACCOUNT_CLIENT_ID ?? '',
});

await geolocationService.startUp();
const location = await geolocationService.lookup('8.8.8.8');
console.info(location?.countryCode);
await geolocationService.shutDown();
```

The adapter uses `DefaultAzureCredential`. In Azure, enable a managed identity on the Function App and assign it the **Azure Maps Data Reader** role scoped to the Azure Maps account. For local development, sign in with `az login` and grant the developer identity the same account-scoped role. `AZURE_MAPS_ACCOUNT_CLIENT_ID` is the unique client ID shown on the Azure Maps account's Authentication page; it is not an Entra application client ID.

Each lookup calls `GET https://atlas.microsoft.com/geolocation/ip/json?api-version=1.0&ip={ip}` with an Entra bearer token and the `x-ms-client-id` header. IPv4 and IPv6 are supported. An unknown or special-purpose IP returns `null`; invalid addresses, unavailable credentials, timeouts, and provider errors reject.

Azure Maps bills Geolocation requests as transactions. The public pricing page currently lists 5,000 free Geolocation transactions per month, then consumption pricing; confirm current rates for your Azure offer and region. See [Azure Maps IP Geolocation](https://learn.microsoft.com/en-us/rest/api/maps/geolocation/get-ip-to-location), [authentication](https://learn.microsoft.com/en-us/azure/azure-maps/azure-maps-authentication), and [pricing](https://azure.microsoft.com/en-us/pricing/details/azure-maps/).

This package is an opt-in provider example. The application composition root must register it instead of the currently selected provider to route lookups through Azure Maps.