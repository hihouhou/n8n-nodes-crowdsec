import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Machine account credential for the CrowdSec Local API (LAPI).
 * Plain field storage: the CrowdSec LAPI node reads the machine_id/password
 * and performs a fresh JWT login (POST /v1/watchers/login) on every execution,
 * so the token can never expire mid-workflow.
 * Machine accounts have read/write access (alerts, decisions deletion,
 * allowlists), but cannot read the bouncer-only /v1/decisions endpoints.
 */
export class CrowdSecLapiMachineApi implements ICredentialType {
	name = 'crowdSecLapiMachineApi';
	displayName = 'CrowdSec LAPI (machine account)';
	documentationUrl = 'https://docs.crowdsec.net/docs/local_api/';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'http://127.0.0.1:8080',
			description: 'URL of the CrowdSec Local API, including scheme and port',
		},
		{
			displayName: 'Machine ID',
			name: 'machineId',
			type: 'string',
			required: true,
			default: '',
			description: 'The machine login (machine_id), e.g. from /etc/crowdsec/local_api_credentials.yaml',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			required: true,
			default: '',
			typeOptions: { password: true },
			description: 'The machine password, e.g. from /etc/crowdsec/local_api_credentials.yaml',
		},
	];

	/**
	 * "Test" button in the credential modal: performs the same JWT login as
	 * the node does on every execution (POST /v1/watchers/login with the
	 * machine_id/password in the JSON body, per the official LAPI swagger and
	 * CrowdSec Go client). 200 + token => credentials valid; 403 => rejected.
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/watchers/login',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				// The LAPI login handler rejects requests whose User-Agent is not
				// exactly "name/version" (HTTP 401 Unauthorized otherwise).
				'User-Agent': 'n8n-nodes-crowdsec/0.1.0',
			},
			json: true,
			body: {
				machine_id: '={{$credentials.machineId}}',
				password: '={{$credentials.password}}',
			},
		},
	};
}
