import { CrowdSecLapi } from './nodes/CrowdSecLapi/CrowdSecLapi.node';
import { CrowdSecConsole } from './nodes/CrowdSecConsole/CrowdSecConsole.node';
import { CrowdSecLapiBouncerApi } from './credentials/CrowdSecLapiBouncerApi.credentials';
import { CrowdSecLapiMachineApi } from './credentials/CrowdSecLapiMachineApi.credentials';
import { CrowdSecConsoleApi } from './credentials/CrowdSecConsoleApi.credentials';

export const nodes = [CrowdSecLapi, CrowdSecConsole];
export const credentials = [
	CrowdSecLapiBouncerApi,
	CrowdSecLapiMachineApi,
	CrowdSecConsoleApi,
];
