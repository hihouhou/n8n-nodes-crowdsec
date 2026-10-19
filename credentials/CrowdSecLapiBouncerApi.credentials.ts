import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CrowdSecLapiBouncerApi implements ICredentialType {
	name = 'crowdSecLapiBouncerApi';
	displayName = 'CrowdSec LAPI (bouncer API key)';
	documentationUrl = 'https://docs.crowdsec.net/docs/local_api/bouncers/';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'http://127.0.0.1:8080',
			description:
				'URL of the CrowdSec Local API, including scheme and port. Keep it on localhost or behind a TLS reverse proxy.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			required: true,
			default: '',
			typeOptions: { password: true },
			hint: 'Create it on the LAPI server with: cscli bouncers add n8n',
			description: 'Bouncer API key (read-only, decisions endpoints only)',
		},
	];

	authenticate: ICredentialType['authenticate'] = {
		type: 'generic',
		properties: {
			headers: {
				'X-Api-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	/**
	 * "Test" button in the credential modal: reads one decision.
	 * This endpoint is bouncer-only, exactly like the node operations that
	 * use this credential. A wrong key makes the LAPI answer 403.
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/decisions?limit=1',
		},
	};
}
