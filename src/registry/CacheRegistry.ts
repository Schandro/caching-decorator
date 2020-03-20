import { ExpiringMap } from '../ExpiringMap';

export interface CacheRegistry {
    getOrInit(targetObject: any, methodName: string): ExpiringMap<string | symbol, any>;
}
