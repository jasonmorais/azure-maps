import { ServiceGeolocationAzureMaps } from '@ocom/service-geolocation-azure-maps';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

const tokenScope = 'https://atlas.microsoft.com/.default';

function createCredential(token: string | null = 'maps-access-token') {
	return {
		getToken: vi.fn(async () => (token ? { token } : null)),
	};
}

function createHttpClient(...responses: Array<{ status: number; data: unknown }>) {
	const get = vi.fn((_url: string, _config: AxiosRequestConfig) => {
		const response = responses.shift();
		if (!response) {
			throw new Error('Unexpected Azure Maps request');
		}
		return Promise.resolve(response);
	});
	return { client: { get } as unknown as AxiosInstance, get };
}

describe('ServiceGeolocationAzureMaps', () => {
	it('maps the country code to the shared result and authenticates with Entra', async () => {
		const { client, get } = createHttpClient({ status: 200, data: { countryRegion: { isoCode: 'US' } } });
		const credential = createCredential();
		const service = new ServiceGeolocationAzureMaps({ clientId: 'maps-account-id' }, client, credential);
		await service.startUp();

		await expect(service.lookup('8.8.8.8')).resolves.toEqual({ countryCode: 'US' });
		expect(credential.getToken).toHaveBeenCalledWith(tokenScope);
		expect(get).toHaveBeenCalledOnce();
		const request = get.mock.calls[0];
		if (!request) {
			throw new Error('Azure Maps request was not made');
		}
		const [requestUrl, requestConfig] = request;
		expect(requestUrl).toBe('https://atlas.microsoft.com/geolocation/ip/json');
		expect(requestConfig).toMatchObject({
			params: { 'api-version': '1.0', ip: '8.8.8.8' },
			headers: {
				accept: 'application/json',
				authorization: 'Bearer maps-access-token',
				'x-ms-client-id': 'maps-account-id',
			},
			timeout: 3000,
		});
	});

	it('supports IPv6 and returns null when Azure Maps has no country', async () => {
		const { client, get } = createHttpClient({ status: 200, data: { countryRegion: null } });
		const service = new ServiceGeolocationAzureMaps({ clientId: 'maps-account-id' }, client, createCredential());
		await service.startUp();

		await expect(service.lookup('2001:4860:4860::8888')).resolves.toBeNull();
		expect(get).toHaveBeenCalledWith(
			'https://atlas.microsoft.com/geolocation/ip/json',
			expect.objectContaining({ params: { 'api-version': '1.0', ip: '2001:4860:4860::8888' } }),
		);
	});

	it('requires a client ID and a started service', async () => {
		await expect(new ServiceGeolocationAzureMaps({ clientId: ' ' }).startUp()).rejects.toThrow('client ID is required');
		const { client } = createHttpClient();
		const service = new ServiceGeolocationAzureMaps({ clientId: 'maps-account-id' }, client, createCredential());
		await expect(service.lookup('8.8.8.8')).rejects.toThrow('not started');
		await service.startUp();
		await service.shutDown();
		await expect(service.lookup('8.8.8.8')).rejects.toThrow('not started');
	});

	it('rejects invalid addresses and does not request a token', async () => {
		const credential = createCredential();
		const { client, get } = createHttpClient();
		const service = new ServiceGeolocationAzureMaps({ clientId: 'maps-account-id' }, client, credential);
		await service.startUp();

		await expect(service.lookup('not-an-ip')).rejects.toThrow('valid IPv4 or IPv6');
		expect(credential.getToken).not.toHaveBeenCalled();
		expect(get).not.toHaveBeenCalled();
	});

	it('rejects when credentials are unavailable or Azure Maps returns an error', async () => {
		const unavailableCredential = createCredential(null);
		const { client } = createHttpClient({ status: 429, data: null });
		const service = new ServiceGeolocationAzureMaps({ clientId: 'maps-account-id' }, client, unavailableCredential);
		await service.startUp();

		await expect(service.lookup('8.8.8.8')).rejects.toThrow('access token is unavailable');

		const authenticatedService = new ServiceGeolocationAzureMaps({ clientId: 'maps-account-id' }, client, createCredential());
		await authenticatedService.startUp();
		await expect(authenticatedService.lookup('8.8.8.8')).rejects.toThrow('status 429');
	});

	it('rejects malformed successful responses and returns null for not found', async () => {
		const { client } = createHttpClient(
			{ status: 200, data: { countryRegion: 'US' } },
			{ status: 404, data: null },
		);
		const service = new ServiceGeolocationAzureMaps({ clientId: 'maps-account-id' }, client, createCredential());
		await service.startUp();

		await expect(service.lookup('8.8.8.8')).rejects.toThrow('invalid response');
		await expect(service.lookup('8.8.8.8')).resolves.toBeNull();
	});
});