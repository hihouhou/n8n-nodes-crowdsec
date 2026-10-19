import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const asString = (value: unknown): string =>
	typeof value === 'string' ? value : value == null ? '' : String(value);

const cleanParams = (params: Record<string, unknown>): Record<string, string | number | boolean> => {
	const result: Record<string, string | number | boolean> = {};
	for (const key of Object.keys(params)) {
		const value = params[key];
		if (value === undefined || value === null || value === '' || value === false) continue;
		result[key] = value as string | number | boolean;
	}
	return result;
};

const booleanFilterField = (options: {
	displayName: string;
	name: string;
	description: string;
	displayOptions: INodeProperties['displayOptions'];
}): INodeProperties => ({
	displayName: options.displayName,
	name: options.name,
	type: 'options',
	noDataExpression: true,
	displayOptions: options.displayOptions,
	options: [
		{ name: 'True', value: 'true' },
		{ name: 'False', value: 'false' },
	],
	default: '',
	description: options.description,
});

const resourceField: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	required: true,
	options: [
		{ name: 'Alert', value: 'alert', description: 'Security alerts detected by CrowdSec' },
		{ name: 'Decision', value: 'decision', description: 'Active remediation decisions (ban, captcha...)' },
		{ name: 'Allowlist', value: 'allowlist', description: 'IP/range allowlists' },
	],
	default: 'alert',
	description: 'The CrowdSec object to work with',
};

const alertOperationField: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	required: true,
	displayOptions: { show: { resource: ['alert'] } },
	options: [
		{ name: 'Get Many', value: 'getAll', description: 'Search/list alerts' },
		{ name: 'Get by ID', value: 'get', description: 'Retrieve a single alert by its ID' },
		{ name: 'Delete by ID', value: 'delete', description: 'Delete a single alert' },
		{ name: 'Delete Many', value: 'deleteMany', description: 'Delete alerts matching filters' },
	],
	default: 'getAll',
	description: 'Operation to perform on alerts',
};

const alertFields: INodeProperties[] = [
	{
		displayName: 'Alert ID',
		name: 'alertId',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['alert'], operation: ['get', 'delete'] } },
		default: '',
		description: 'Numeric ID of the alert',
	},
	{
		displayName: 'Since',
		name: 'since',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll'] } },
		default: '',
		placeholder: 'e.g. 1h, 30m, 24h',
		description: 'Only alerts newer than this duration (Go duration format: 1h, 30m, 24h, 7d...)',
	},
	{
		displayName: 'Until',
		name: 'until',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll'] } },
		default: '',
		placeholder: 'e.g. 1h',
		description: 'Only alerts older than this duration (Go duration format)',
	},
	{
		displayName: 'IP',
		name: 'ip',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll'] } },
		default: '',
		description: 'Only alerts for this IP',
	},
	{
		displayName: 'Range',
		name: 'range',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll'] } },
		default: '',
		placeholder: 'e.g. 1.2.3.0/24',
		description: 'Only alerts for this network range',
	},
	{
		displayName: 'Scope',
		name: 'scope',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll', 'deleteMany'] } },
		default: '',
		description: 'Scope to search (ip, range, username, session...)',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll', 'deleteMany'] } },
		default: '',
		description: 'Value to match for the given scope',
	},
	{
		displayName: 'Scenario',
		name: 'scenario',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll', 'deleteMany'] } },
		default: '',
		placeholder: 'e.g. crowdsecurity/ssh-bf',
		description: 'Only alerts for this scenario',
	},
	{
		displayName: 'Decision Type',
		name: 'decisionType',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll'] } },
		default: '',
		placeholder: 'e.g. ban',
		description: 'Only alerts with decisions of this type',
	},
	{
		displayName: 'Origin',
		name: 'origin',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll'] } },
		default: '',
		placeholder: 'e.g. crowdsec, cscli, lists',
		description: 'Only alerts with this origin',
	},
	booleanFilterField({
		displayName: 'Has Active Decision',
		name: 'hasActiveDecision',
		displayOptions: { show: { resource: ['alert'], operation: ['getAll', 'deleteMany'] } },
		description: 'Filter on alerts having (or not) an active decision',
	}),
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { numberPrecision: 0 },
		displayOptions: { show: { resource: ['alert'], operation: ['getAll'] } },
		default: 100,
		description: 'Maximum number of alerts to return (most recent first)',
	},
	{
		displayName: 'IP',
		name: 'deleteIp',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['deleteMany'] } },
		default: '',
		description: 'Delete alerts for this IP',
	},
	{
		displayName: 'Range',
		name: 'deleteRange',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['deleteMany'] } },
		default: '',
		description: 'Delete alerts for this network range',
	},
	{
		displayName: 'Since',
		name: 'deleteSince',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['deleteMany'] } },
		default: '',
		placeholder: 'YYYY-MM-DD HH:mm:ss',
		description: 'Delete alerts added after this date',
	},
	{
		displayName: 'Until',
		name: 'deleteUntil',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['deleteMany'] } },
		default: '',
		placeholder: 'YYYY-MM-DD HH:mm:ss',
		description: 'Delete alerts added before this date',
	},
	{
		displayName: 'Alert Source',
		name: 'alertSource',
		type: 'string',
		displayOptions: { show: { resource: ['alert'], operation: ['deleteMany'] } },
		default: '',
		placeholder: 'cscli or crowdsec',
		description: 'Delete only alerts from this source',
	},
];

const decisionOperationField: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	required: true,
	displayOptions: { show: { resource: ['decision'] } },
	options: [
		{ name: 'Get Many', value: 'getAll', description: 'List active decisions' },
		{ name: 'Get Stream', value: 'stream', description: 'Stream new/expired decisions (bouncer-style)' },
		{ name: 'Delete Many', value: 'deleteMany', description: 'Delete decisions matching filters' },
		{ name: 'Delete by ID', value: 'delete', description: 'Delete a single decision by its ID' },
	],
	default: 'getAll',
	description: 'Operation to perform on decisions',
};

const decisionFields: INodeProperties[] = [
	{
		displayName: 'IP',
		name: 'ip',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['getAll', 'deleteMany'] } },
		default: '',
		description: 'Decisions for this IP (shorthand for scope=ip)',
	},
	{
		displayName: 'Range',
		name: 'range',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['getAll', 'deleteMany'] } },
		default: '',
		placeholder: 'e.g. 1.2.3.0/24',
		description: 'Decisions for this range (shorthand for scope=range)',
	},
	{
		displayName: 'Scope',
		name: 'scope',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['getAll', 'deleteMany'] } },
		default: '',
		description: 'Scope to search (ip, range, username, session...)',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['getAll', 'deleteMany'] } },
		default: '',
		description: 'Value to match for the given scope',
	},
	{
		displayName: 'Type',
		name: 'decisionType',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['getAll', 'deleteMany'] } },
		default: '',
		placeholder: 'e.g. ban',
		description: 'Type of decision (ban, captcha...)',
	},
	{
		displayName: 'Origins',
		name: 'origins',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['getAll'] } },
		default: '',
		placeholder: 'e.g. cscli,crowdsec',
		description: 'Comma-separated decision origins',
	},
	{
		displayName: 'Contains',
		name: 'contains',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['decision'], operation: ['getAll'] } },
		options: [
			{ name: 'True', value: 'true' },
			{ name: 'False', value: 'false' },
		],
		default: '',
		description: 'Look for decisions contained in (or containing) the value',
	},
	{
		displayName: 'Scenario',
		name: 'scenario',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['deleteMany'] } },
		default: '',
		placeholder: 'e.g. crowdsecurity/ssh-bf',
		description: 'Delete decisions created by this scenario',
	},
	{
		displayName: 'Startup',
		name: 'startup',
		type: 'boolean',
		displayOptions: { show: { resource: ['decision'], operation: ['stream'] } },
		default: false,
		description: 'If true, return the full list of current decisions instead of the delta',
	},
	{
		displayName: 'Decision ID',
		name: 'decisionId',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['decision'], operation: ['delete'] } },
		default: '',
		description: 'Numeric ID of the decision to delete',
	},
];

const allowlistOperationField: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	required: true,
	displayOptions: { show: { resource: ['allowlist'] } },
	options: [
		{ name: 'Get Many', value: 'getAll', description: 'List all allowlists' },
		{ name: 'Get by Name', value: 'get', description: 'Get one allowlist by its name' },
		{ name: 'Check IP or Range', value: 'check', description: 'Check if an IP or range is allowlisted' },
	],
	default: 'getAll',
	description: 'Operation to perform on allowlists',
};

const allowlistFields: INodeProperties[] = [
	{
		displayName: 'Allowlist Name',
		name: 'allowlistName',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['allowlist'], operation: ['get'] } },
		default: '',
		description: 'Name of the allowlist',
	},
	{
		displayName: 'IP or Range',
		name: 'ipOrRange',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['allowlist'], operation: ['check'] } },
		default: '',
		placeholder: 'e.g. 1.2.3.4 or 1.2.3.0/24',
		description: 'The IP or CIDR range to check',
	},
];

export class CrowdSecLapi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CrowdSec LAPI',
		name: 'crowdSecLapi',
		icon: 'file:crowdsec.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter.resource + ": " + $parameter.operation}}',
		description:
			'List alerts, decisions and allowlists from a CrowdSec Local API (LAPI), and delete decisions or alerts',
		defaults: { name: 'CrowdSec LAPI' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{ name: 'crowdSecLapiBouncerApi', required: false },
			{ name: 'crowdSecLapiMachineApi', required: false },
		],
		properties: [
			resourceField,
			alertOperationField,
			...alertFields,
			decisionOperationField,
			...decisionFields,
			allowlistOperationField,
			...allowlistFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const node = this.getNode();
		const resource = asString(this.getNodeParameter('resource', 0));
		const operation = asString(this.getNodeParameter('operation', 0));
		const op = `${resource}:${operation}`;

		const nodeCredentials = (node as unknown as { credentials?: Record<string, unknown> }).credentials;
		const hasBouncer = !!(nodeCredentials && nodeCredentials.crowdSecLapiBouncerApi);
		const hasMachine = !!(nodeCredentials && nodeCredentials.crowdSecLapiMachineApi);

		// LAPI permissions: bouncer keys are read-only and only cover the
		// /v1/decisions endpoints. Machine (JWT) accounts cover alerts,
		// deletions and allowlists, but cannot read /v1/decisions.
		const OPS_NEEDING_MACHINE = [
			'alert:getAll',
			'alert:get',
			'alert:delete',
			'alert:deleteMany',
			'decision:deleteMany',
			'decision:delete',
			'allowlist:getAll',
			'allowlist:get',
			'allowlist:check',
		];
		const OPS_BOUNCER_ONLY = ['decision:getAll', 'decision:stream'];

		if (OPS_NEEDING_MACHINE.includes(op) && !hasMachine) {
			throw new NodeApiError(node, {
				message: `The operation "${op}" requires a "CrowdSec LAPI (machine account)" credential`,
				description:
					'Bouncer API keys are read-only and limited to the decisions endpoints. Alerts, deletions and allowlists require machine credentials (login/password, JWT).',
				hint: 'Use the machine_id and password from /etc/crowdsec/local_api_credentials.yaml on the LAPI server',
			});
		}
		if (OPS_BOUNCER_ONLY.includes(op) && !hasBouncer) {
			throw new NodeApiError(node, {
				message: `The operation "${op}" requires a "CrowdSec LAPI (bouncer API key)" credential`,
				description:
					'Machine (JWT) accounts cannot read the bouncer-only /v1/decisions endpoints. Create a bouncer key with: cscli bouncers add n8n',
			});
		}

		const credentialType =
			OPS_BOUNCER_ONLY.includes(op) && hasBouncer
				? 'crowdSecLapiBouncerApi'
				: hasMachine
					? 'crowdSecLapiMachineApi'
					: 'crowdSecLapiBouncerApi';

		const credentialsData = await this.getCredentials(credentialType);
		const baseUrl = String(credentialsData.baseUrl || 'http://127.0.0.1:8080').replace(/\/+$/, '');

		// Bouncer credentials never expire: let n8n inject the X-Api-Key
		// automatically. Machine credentials use a JWT that can expire, so we
		// perform a fresh login for each execution to guarantee the token is
		// always valid, even for long-running scheduled workflows.
		let authHeaders: Record<string, string> | undefined;
		if (credentialType === 'crowdSecLapiMachineApi') {
			const loginResponse = await this.helpers.httpRequest({
				method: 'POST',
				url: `${baseUrl}/v1/watchers/login`,
				headers: {
					// The LAPI login handler rejects requests whose User-Agent is not
					// exactly "name/version" (HTTP 401 Unauthorized otherwise).
					'User-Agent': 'n8n-nodes-crowdsec/0.1.0',
				},
				body: {
					machine_id: credentialsData.machineId,
					password: credentialsData.password,
				},
				json: true,
			}) as { token?: string };
			if (!loginResponse || !loginResponse.token) {
				throw new NodeApiError(node, {
					message: 'CrowdSec LAPI login failed: no token returned',
					description:
						'Check the machine ID and password of your "CrowdSec LAPI (machine account)" credential',
				});
			}
			authHeaders = { Authorization: `Bearer ${loginResponse.token}` };
		}

		const responseData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				let method: IHttpRequestOptions['method'] = 'GET';
				let path = '';
				let qs: Record<string, string | number | boolean> = {};
				let body: Record<string, unknown> | undefined;

				switch (op) {
					case 'alert:getAll':
						method = 'GET';
						path = '/v1/alerts';
						qs = cleanParams({
							since: this.getNodeParameter('since', itemIndex, ''),
							until: this.getNodeParameter('until', itemIndex, ''),
							ip: this.getNodeParameter('ip', itemIndex, ''),
							range: this.getNodeParameter('range', itemIndex, ''),
							scope: this.getNodeParameter('scope', itemIndex, ''),
							value: this.getNodeParameter('value', itemIndex, ''),
							scenario: this.getNodeParameter('scenario', itemIndex, ''),
							decision_type: this.getNodeParameter('decisionType', itemIndex, ''),
							origin: this.getNodeParameter('origin', itemIndex, ''),
							has_active_decision: this.getNodeParameter('hasActiveDecision', itemIndex, ''),
							limit: this.getNodeParameter('limit', itemIndex, 100),
						});
						break;

					case 'alert:get':
						method = 'GET';
						path = `/v1/alerts/${encodeURIComponent(asString(this.getNodeParameter('alertId', itemIndex)))}`;
						break;

					case 'alert:delete':
						method = 'DELETE';
						path = `/v1/alerts/${encodeURIComponent(asString(this.getNodeParameter('alertId', itemIndex)))}`;
						break;

					case 'alert:deleteMany':
						method = 'DELETE';
						path = '/v1/alerts';
						qs = cleanParams({
							ip: this.getNodeParameter('deleteIp', itemIndex, ''),
							range: this.getNodeParameter('deleteRange', itemIndex, ''),
							scope: this.getNodeParameter('scope', itemIndex, ''),
							value: this.getNodeParameter('value', itemIndex, ''),
							scenario: this.getNodeParameter('scenario', itemIndex, ''),
							since: this.getNodeParameter('deleteSince', itemIndex, ''),
							until: this.getNodeParameter('deleteUntil', itemIndex, ''),
							has_active_decision: this.getNodeParameter('hasActiveDecision', itemIndex, ''),
							alert_source: this.getNodeParameter('alertSource', itemIndex, ''),
						});
						break;

					case 'decision:getAll':
						method = 'GET';
						path = '/v1/decisions';
						qs = cleanParams({
							scope: this.getNodeParameter('scope', itemIndex, ''),
							value: this.getNodeParameter('value', itemIndex, ''),
							type: this.getNodeParameter('decisionType', itemIndex, ''),
							ip: this.getNodeParameter('ip', itemIndex, ''),
							range: this.getNodeParameter('range', itemIndex, ''),
							contains: this.getNodeParameter('contains', itemIndex, ''),
							origins: this.getNodeParameter('origins', itemIndex, ''),
						});
						break;

					case 'decision:stream':
						method = 'GET';
						path = '/v1/decisions/stream';
						qs = cleanParams({
							startup: this.getNodeParameter('startup', itemIndex, false) ? 'true' : '',
						});
						break;

					case 'decision:deleteMany':
						method = 'DELETE';
						path = '/v1/decisions';
						qs = cleanParams({
							scope: this.getNodeParameter('scope', itemIndex, ''),
							value: this.getNodeParameter('value', itemIndex, ''),
							type: this.getNodeParameter('decisionType', itemIndex, ''),
							ip: this.getNodeParameter('ip', itemIndex, ''),
							range: this.getNodeParameter('range', itemIndex, ''),
							scenario: this.getNodeParameter('scenario', itemIndex, ''),
						});
						break;

					case 'decision:delete':
						method = 'DELETE';
						path = `/v1/decisions/${encodeURIComponent(asString(this.getNodeParameter('decisionId', itemIndex)))}`;
						break;

					case 'allowlist:getAll':
						method = 'GET';
						path = '/v1/allowlists';
						break;

					case 'allowlist:get':
						method = 'GET';
						path = `/v1/allowlists/${encodeURIComponent(asString(this.getNodeParameter('allowlistName', itemIndex)))}`;
						break;

					case 'allowlist:check':
						method = 'GET';
						path = `/v1/allowlists/check/${encodeURIComponent(asString(this.getNodeParameter('ipOrRange', itemIndex)))}`;
						break;

					default:
						throw new Error(`Unknown operation: ${op}`);
				}

				const requestOptions: IHttpRequestOptions = {
					method,
					url: `${baseUrl}${path}`,
					qs,
					body,
					json: true,
				};
				const response = authHeaders
					? await this.helpers.httpRequest({ ...requestOptions, headers: authHeaders })
					: await this.helpers.httpRequestWithAuthentication.call(
							this,
							credentialType,
							requestOptions,
						);

				if (Array.isArray(response)) {
					for (const entry of response) {
						responseData.push({ json: entry as IDataObject });
					}
				} else {
					responseData.push({ json: response as IDataObject });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					responseData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
					});
					continue;
				}
				throw new NodeApiError(node, error);
			}
		}

		return [this.helpers.returnJsonArray(responseData.map((d) => d.json))];
	}
}
