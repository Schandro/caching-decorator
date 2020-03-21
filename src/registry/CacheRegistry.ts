import { ExpiringMap } from '../ExpiringMap';

export interface CacheRegistry {
    getOrInit(targetObject: any, methodName: string): ExpiringMap<string, any>;
    getOrInitDir(targetObject: any): Set<string>;
}
