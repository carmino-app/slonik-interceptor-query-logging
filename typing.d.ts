import { InterceptorType } from 'slonik';
import type { LoggerType } from 'roarr';
export type { LoggerType };

export interface UserConfigurationType {
	logValues?: boolean;
	logger?: (context: ConnectionContextType) => LoggerType;
}
export function createQueryLoggingInterceptor(userConfiguration?: UserConfigurationType): InterceptorType;
