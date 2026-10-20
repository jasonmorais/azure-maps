import axios, { type AxiosInstance } from 'axios';
import { DefaultAzureCredential } from '@azure/identity';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type {
	GeolocationInfrastructureService,
	GeolocationLookupResult,
	GeolocationService,
} from '@cellix/service-geolocation-base';

export type { GeolocationInfrastructureService } from '@cellix/service-geolocation-base';

/** Minimal token credential contract, also implemented by Azure Identity credentials. */
export interface AzureMapsTokenCredential {
	getToken(scopes: string | string[]): Promise<{ readonly token: string } | null>;
}

/** Configuration for the Azure Maps IP geolocation API. */
export interface AzureMapsOptions {
	/** The unique client ID of the Azure Maps account, not an Entra application ID. */
	readonly clientId?: string;
	/** Request timeout in milliseconds. Defaults to 3000. */
	readonly timeoutMs?: number;
}

interface IpToLocationResponse {
	readonly countryRegion?: {
		readonly isoCode?: unknown;
	} | null;
}

const tokenScope = 'https://atlas.microsoft.com/.default';
const environmentFilePath = fileURLToPath(new URL('../.env', import.meta.url));

function mapResponse(body: unknown): GeolocationLookupResult | null {
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		throw new TypeError('Azure Maps geolocation returned an invalid response');
	}

	const { countryRegion } = body as IpToLocationResponse;
	if (countryRegion != null && (typeof countryRegion !== 'object' || Array.isArray(countryRegion))) {
		throw new TypeError('Azure Maps geolocation returned an invalid response');
	}

	const { isoCode } = countryRegion ?? {};
	if (typeof isoCode !== 'string') {
		return null;
	}
	const countryCode = isoCode.trim().toUpperCase();
	return /^[A-Z]{2}$/.test(countryCode) ? { countryCode } : null;
}

/**
 * Looks up the country for an IPv4 or IPv6 address using Azure Maps Geolocation.
 * Azure Maps returns an ISO country code; this adapter exposes that code directly.
 */
export class ServiceGeolocationAzureMaps implements GeolocationInfrastructureService {
	private readonly clientIdOverride: string | undefined;
	private clientId = '';
	private readonly timeoutMs: number;
	private readonly credential: AzureMapsTokenCredential;
	private readonly httpClient: AxiosInstance;
	private started = false;

	/** Creates the adapter with an Azure Maps account client ID and optional test seams. */
	public constructor(
		options: AzureMapsOptions = {},
		httpClient: AxiosInstance | undefined = undefined,
		credential: AzureMapsTokenCredential = new DefaultAzureCredential(),
	) {
		this.clientIdOverride = options.clientId?.trim();
		this.timeoutMs = options.timeoutMs ?? 3000;
		this.httpClient = httpClient ?? axios.create({ timeout: this.timeoutMs });
		this.credential = credential;
	}

	/** Validates configuration and enables lookups. */
	public startUp(): Promise<GeolocationService> {
		dotenv.config({ path: environmentFilePath });
		this.clientId = this.clientIdOverride ?? (process.env['AZURE_MAPS_ACCOUNT_CLIENT_ID'] ?? process.env['AZURE_MAPS_CLIENT_ID'] ?? '').trim();
		if (!this.clientId) {
			return Promise.reject(new Error('Azure Maps account client ID is required'));
		}
		this.started = true;
		return Promise.resolve(this);
	}

	/** Disables lookups until the next startup. */
	public shutDown(): Promise<void> {
		this.started = false;
		return Promise.resolve();
	}

	/** Returns normalized country data, or null when Azure Maps has no country for the IP. */
	public async lookup(ip: string): Promise<GeolocationLookupResult | null> {
		if (isIP(ip) === 0) {
			throw new Error('A valid IPv4 or IPv6 address is required');
		}
		if (!this.started) {
			throw new Error('Azure Maps geolocation service is not started');
		}

		const accessToken = await this.credential.getToken(tokenScope);
		if (!accessToken?.token) {
			throw new Error('Azure Maps access token is unavailable');
		}

		const response = await this.httpClient.get<IpToLocationResponse>('https://atlas.microsoft.com/geolocation/ip/json', {
			params: { 'api-version': '1.0', ip },
			headers: {
				accept: 'application/json',
				authorization: `Bearer ${accessToken.token}`,
				'x-ms-client-id': this.clientId,
			},
			timeout: this.timeoutMs,
			validateStatus: () => true,
		});
		if (response.status === 404) {
			return null;
		}
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Azure Maps geolocation failed with status ${response.status}`);
		}

		return mapResponse(response.data);
	}
}