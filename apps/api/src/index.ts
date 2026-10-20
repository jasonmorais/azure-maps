import { isIP } from 'node:net';
import { Cellix } from '@cellix/api-core';
import { ServiceGeolocationAzureMaps } from '@ocom/service-geolocation-azure-maps';
import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { buildSchema, graphql } from 'graphql';

interface ApiContext {
	geolocationService: ServiceGeolocationAzureMaps;
}

interface GraphqlRequestContext {
	request: HttpRequest;
	geolocationService: ServiceGeolocationAzureMaps;
}

interface HealthResult {
	status: string;
	ip: string | null;
	countryCode: string | null;
}

const schema = buildSchema(`
	type Query {
		health: Health!
	}

	type Health {
		status: String!
		ip: String
		countryCode: String
	}
`);

const isDevelopment = process.env['NODE_ENV'] === 'development';
const developmentIp = '8.8.8.8';

function getClientIp(request: HttpRequest): string | null {
	if (isDevelopment) {
		return isIP(developmentIp) !== 0 ? developmentIp : null;
	}

	const forwardedFor = request.headers.get('x-forwarded-for');
	const candidate = forwardedFor?.split(',')[0]?.trim();
	return candidate && isIP(candidate) !== 0 ? candidate : null;
}

async function readQuery(request: HttpRequest): Promise<string | null> {
	if (request.method === 'GET') {
		return new URL(request.url).searchParams.get('query');
	}

	try {
		const body: unknown = await request.json();
		if (body === null || typeof body !== 'object' || Array.isArray(body)) {
			return null;
		}
		const query = (body as { query?: unknown }).query;
		return typeof query === 'string' ? query : null;
	} catch {
		return null;
	}
}

function jsonResponse(body: unknown, status = 200): HttpResponseInit {
	return {
		status,
		jsonBody: body,
		headers: { 'content-type': 'application/json; charset=utf-8' },
	};
}

const clientId = process.env['AZURE_MAPS_CLIENT_ID'] ?? '';

void Cellix.initializeInfrastructureServices<ApiContext, ApiContext>((serviceRegistry) => {
	serviceRegistry.registerInfrastructureService(new ServiceGeolocationAzureMaps({ clientId }));
})
	.setContext((serviceRegistry) => ({
		geolocationService: serviceRegistry.getInfrastructureService<ServiceGeolocationAzureMaps>(ServiceGeolocationAzureMaps),
	}))
	.initializeApplicationServices((context) => ({ forRequest: async () => context }))
	.registerAzureFunctionHttpHandler('graphql', { authLevel: 'function', route: 'graphql', methods: ['GET', 'POST'] }, (applicationServicesHost) => async (request) => {
		const query = await readQuery(request);
		if (!query) {
			return jsonResponse({ errors: [{ message: 'A GraphQL query is required.' }] }, 400);
		}

		const applicationServices = await applicationServicesHost.forRequest();
		const result = await graphql({
			schema,
			source: query,
			contextValue: {
				request,
				geolocationService: applicationServices.geolocationService,
			} satisfies GraphqlRequestContext,
			rootValue: {
				health: async (_source: unknown, _args: unknown, context: GraphqlRequestContext): Promise<HealthResult> => {
					const ip = getClientIp(context.request);
					const location = ip ? await context.geolocationService.lookup(ip) : null;
					return {
						status: 'ok',
						ip,
						countryCode: location?.countryCode ?? null,
					};
				},
			},
		});

		return jsonResponse(result);
	})
	.startUp();