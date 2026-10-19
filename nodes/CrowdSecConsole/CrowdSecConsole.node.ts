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
		if (value === undefined || value === null || value === '') continue;
		result[key] = value as string | number | boolean;
	}
	return result;
};

const resourceField: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	required: true,
	options: [
		{ name: 'Decision', value: 'decision', description: 'Organization-wide decisions (console management)' },
		{ name: 'Blocklist', value: 'blocklist', description: 'Public and private blocklists' },
		{ name: 'Integration', value: 'integration', description: 'Blocklist integrations' },
		{ name: 'Organization', value: 'organization', description: 'Organization information' },
	],
	default: 'decision',
	description: 'The CrowdSec Console object to work with',
};

const decisionOperationField: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	required: true,
	displayOptions: { show: { resource: ['decision'] } },
	options: [
		{ name: 'Get Many', value: 'getAll', description: 'List org decisions (paginated)' },
		{ name: 'Get Aggregated', value: 'getAggregated', description: 'View aggregated decisions' },
		{ name: 'Create', value: 'create', description: 'Push a decision to engines of your organization' },
		{ name: 'Delete', value: 'delete', description: 'Delete a decision by its UUID' },
	],
	default: 'getAll',
	description: 'Operation to perform on decisions',
};

const decisionFields: INodeProperties[] = [
	{
		displayName: 'Page',
		name: 'page',
		type: 'number',
		typeOptions: { numberPrecision: 0 },
		displayOptions: { show: { resource: ['decision'], operation: ['getAll'] } },
		default: 1,
		description: 'Page number',
	},
	{
		displayName: 'Size',
		name: 'size',
		type: 'number',
		typeOptions: { numberPrecision: 0 },
		displayOptions: { show: { resource: ['decision'], operation: ['getAll'] } },
		default: 50,
		description: 'Number of items per page',
	},
	{
		displayName: 'IPs',
		name: 'ips',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['getAll'] } },
		default: '',
		placeholder: 'e.g. 1.2.3.4,5.6.7.8',
		description: 'Only decisions for these IPs (comma-separated)',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['decision'], operation: ['create'] } },
		default: '',
		placeholder: 'e.g. 1.2.3.4',
		description: 'Value the decision applies to (IP, range, username...)',
	},
	{
		displayName: 'Scope',
		name: 'scope',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['decision'], operation: ['create'] } },
		options: [
			{ name: 'Ip', value: 'Ip' },
			{ name: 'Range', value: 'Range' },
			{ name: 'Username', value: 'Username' },
			{ name: 'Session', value: 'Session' },
		],
		default: 'Ip',
		description: 'Scope of the decision',
	},
	{
		displayName: 'Type',
		name: 'decisionType',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['create'] } },
		default: 'ban',
		description: 'Type of the decision (ban, captcha, ...)',
	},
	{
		displayName: 'Duration',
		name: 'duration',
		type: 'string',
		displayOptions: { show: { resource: ['decision'], operation: ['create'] } },
		default: '4h',
		placeholder: 'e.g. 4h, 30m, 7d',
		description: 'Duration of the decision (Go duration format)',
	},
	{
		displayName: 'Target Type',
		name: 'targetType',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['decision'], operation: ['create'] } },
		options: [
			{ name: 'Organization', value: 'org', description: 'Apply to all engines of the organization' },
			{ name: 'Security Engine', value: 'entity', description: 'Apply to one engine (machine ID)' },
			{ name: 'Tag', value: 'tag', description: 'Apply to all engines carrying a tag' },
		],
		default: 'org',
		description: 'Who enforces the decision',
	},
	{
		displayName: 'Target Value',
		name: 'targetValue',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['decision'], operation: ['create'] } },
		default: '',
		placeholder: 'org id, engine machine id or tag',
		description: 'The org ID, engine machine ID or tag the decision targets',
	},
	{
		displayName: 'Decision UUID',
		name: 'decisionUuid',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['decision'], operation: ['delete'] } },
		default: '',
		description: 'UUID of the decision to delete',
	},
];

const blocklistOperationField: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	required: true,
	displayOptions: { show: { resource: ['blocklist'] } },
	options: [
		{ name: 'Get Many', value: 'getAll', description: 'List blocklists' },
		{ name: 'Get by ID', value: 'get', description: 'Get one blocklist by its ID' },
		{ name: 'Create', value: 'create', description: 'Create a private blocklist' },
		{ name: 'Delete', value: 'delete', description: 'Delete a blocklist by its ID' },
		{ name: 'Download Content', value: 'download', description: 'Download the raw content of a blocklist' },
		{ name: 'Add IPs', value: 'addIps', description: 'Add IPs to a blocklist (with expiration)' },
		{ name: 'Delete IPs', value: 'deleteIps', description: 'Remove IPs from a blocklist' },
	],
	default: 'getAll',
	description: 'Operation to perform on blocklists',
};

const blocklistFields: INodeProperties[] = [
	{
		displayName: 'Blocklist ID',
		name: 'blocklistId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['blocklist'],
				operation: ['get', 'delete', 'download', 'addIps', 'deleteIps'],
			},
		},
		default: '',
		description: 'ID of the blocklist',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['blocklist'], operation: ['create'] } },
		default: '',
		description: 'Name of the new blocklist',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		displayOptions: { show: { resource: ['blocklist'], operation: ['create'] } },
		default: '',
		description: 'Description of the new blocklist',
	},
	{
		displayName: 'IPs',
		name: 'ips',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['blocklist'], operation: ['addIps', 'deleteIps'] } },
		default: '',
		placeholder: 'e.g. 1.2.3.4,5.6.7.8',
		description: 'Comma-separated list of IPs',
	},
	{
		displayName: 'Expiration',
		name: 'expiration',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['blocklist'], operation: ['addIps'] } },
		default: '',
		placeholder: 'e.g. 2026-10-18T12:00:00Z',
		description: 'Mandatory date when the IPs are removed from the blocklist (ISO 8601)',
	},
];

const integrationOperationField: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	required: true,
	displayOptions: { show: { resource: ['integration'] } },
	options: [
		{ name: 'Get Many', value: 'getAll', description: 'List integrations' },
		{ name: 'Get Content', value: 'getContent', description: 'Get the current content of an integration' },
	],
	default: 'getAll',
	description: 'Operation to perform on integrations',
};

const integrationFields: INodeProperties[] = [
	{
		displayName: 'Integration ID',
		name: 'integrationId',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['integration'], operation: ['getContent'] } },
		default: '',
		description: 'ID of the integration',
	},
];

const organizationOperationField: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	required: true,
	displayOptions: { show: { resource: ['organization'] } },
	options: [{ name: 'Get Info', value: 'getInfo', description: 'Get organization info, including org_id' }],
	default: 'getInfo',
	description: 'Operation to perform on the organization',
};

export class CrowdSecConsole implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CrowdSec Console',
		name: 'crowdSecConsole',
		icon: 'file:crowdsec.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter.resource + ": " + $parameter.operation}}',
		description:
			'Manage decisions, blocklists and integrations on the CrowdSec Console (Service API admin.api.crowdsec.net)',
		defaults: { name: 'CrowdSec Console' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'crowdSecConsoleApi', required: true }],
		properties: [
			resourceField,
			decisionOperationField,
			...decisionFields,
			blocklistOperationField,
			...blocklistFields,
			integrationOperationField,
			...integrationFields,
			organizationOperationField,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const node = this.getNode();
		const resource = asString(this.getNodeParameter('resource', 0));
		const operation = asString(this.getNodeParameter('operation', 0));
		const op = `${resource}:${operation}`;

		const credentialsData = await this.getCredentials('crowdSecConsoleApi');
		const baseUrl = String(credentialsData.baseUrl || 'https://admin.api.crowdsec.net').replace(/\/+$/, '');

		const responseData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				let method: IHttpRequestOptions['method'] = 'GET';
				let path = '';
				let qs: Record<string, string | number | boolean> = {};
				let body: Record<string, unknown> | undefined;

				switch (op) {
					case 'decision:getAll':
						method = 'GET';
						path = '/v1/decisions';
						qs = cleanParams({
							page: this.getNodeParameter('page', itemIndex, 1),
							size: this.getNodeParameter('size', itemIndex, 50),
							ips: this.getNodeParameter('ips', itemIndex, ''),
						});
						break;

					case 'decision:getAggregated':
						method = 'GET';
						path = '/v1/decisions/aggregated';
						break;

					case 'decision:create':
						method = 'POST';
						path = '/v1/decisions';
						body = {
							duration: asString(this.getNodeParameter('duration', itemIndex, '4h')),
							origin: 'cscli',
							scenario: 'manual',
							scope: asString(this.getNodeParameter('scope', itemIndex, 'Ip')),
							type: asString(this.getNodeParameter('decisionType', itemIndex, 'ban')),
							value: asString(this.getNodeParameter('value', itemIndex, '')),
							target: {
								type: asString(this.getNodeParameter('targetType', itemIndex, 'org')),
								value: asString(this.getNodeParameter('targetValue', itemIndex, '')),
							},
						};
						break;

					case 'decision:delete':
						method = 'DELETE';
						path = `/v1/decisions/${encodeURIComponent(asString(this.getNodeParameter('decisionUuid', itemIndex)))}`;
						break;

					case 'blocklist:getAll':
						method = 'GET';
						path = '/v1/blocklists';
						break;

					case 'blocklist:get':
						method = 'GET';
						path = `/v1/blocklists/${encodeURIComponent(asString(this.getNodeParameter('blocklistId', itemIndex)))}`;
						break;

					case 'blocklist:create':
						method = 'POST';
						path = '/v1/blocklists';
						body = {
							name: asString(this.getNodeParameter('name', itemIndex, '')),
							description: asString(this.getNodeParameter('description', itemIndex, '')),
						};
						break;

					case 'blocklist:delete':
						method = 'DELETE';
						path = `/v1/blocklists/${encodeURIComponent(asString(this.getNodeParameter('blocklistId', itemIndex)))}`;
						break;

					case 'blocklist:download':
						method = 'GET';
						path = `/v1/blocklists/${encodeURIComponent(asString(this.getNodeParameter('blocklistId', itemIndex)))}/download`;
						break;

					case 'blocklist:addIps':
					case 'blocklist:deleteIps': {
						const blocklistId = encodeURIComponent(asString(this.getNodeParameter('blocklistId', itemIndex)));
						const ips = asString(this.getNodeParameter('ips', itemIndex, ''))
							.split(',')
							.map((ip) => ip.trim())
							.filter(Boolean);
						if (ips.length === 0) {
							throw new Error('At least one IP is required');
						}
						method = 'POST';
						path = `/v1/blocklists/${blocklistId}${op === 'blocklist:addIps' ? '/ips' : '/ips/delete'}`;
						body =
							op === 'blocklist:addIps'
								? {
										ips,
										expiration: asString(this.getNodeParameter('expiration', itemIndex, '')),
									}
								: { ips };
						break;
					}

					case 'integration:getAll':
						method = 'GET';
						path = '/v1/integrations';
						break;

					case 'integration:getContent':
						method = 'GET';
						path = `/v1/integrations/${encodeURIComponent(asString(this.getNodeParameter('integrationId', itemIndex)))}/content`;
						break;

					case 'organization:getInfo':
						method = 'GET';
						path = '/v1/info';
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
				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'crowdSecConsoleApi',
					requestOptions,
				);

				// Some endpoints (blocklist/integration content) return plain text
				if (typeof response === 'string') {
					responseData.push({ json: { content: response } });
				} else if (Array.isArray(response)) {
					for (const entry of response) {
						responseData.push({ json: entry as IDataObject });
					}
				} else {
					responseData.push({ json: response as IDataObject });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					responseData.push({
						json: { error: error instanceof Error ? error.message : String(error) },
					});
					continue;
				}
				throw new NodeApiError(node, error);
			}
		}

		return [this.helpers.returnJsonArray(responseData.map((d) => d.json))];
	}
}
