import { ExpiringMap } from '../ExpiringMap';
import { Method } from '../Types';

export interface CacheRegistry {
    getOrInit(targetObject: any, method: Method): ExpiringMap<string | symbol, any>;
}
