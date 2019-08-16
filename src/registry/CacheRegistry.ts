import { ExpiringMap } from '@/ExpiringMap';
import { Method } from '@/Cacheable';

export interface CacheRegistry {
    getOrInit(targetObject: any, method: Method): ExpiringMap<string, any>;
}
