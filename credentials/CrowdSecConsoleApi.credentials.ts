import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Credential for the CrowdSec Console Service API (admin.api.crowdsec.net).
 * Create a Service API key in the Console: Settings -> Service API Keys.
 */
export class CrowdSecConsoleApi implements ICredentialType {
	name = 'crowdSecConsoleApi';
	displayName = 'CrowdSec Console Service API';
	documentationUrl = 'https://docs.crowdsec.net/u/console/api/intro/';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://admin.api.crowdsec.net',
			description: 'Base URL of the CrowdSec Console Service API',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			required: true,
			default: '',
			typeOptions: { password: true },
			description: 'Service API key created in app.crowdsec.net (Settings -> Service API Keys)',
		},
	];

	authenticate: ICredentialType['authenticate'] = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	/**
	 * "Test" button in the credential modal: reads the organization info,
	 * the same endpoint as the "Organization > Get Info" operation.
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/info',
		},
	};
}
