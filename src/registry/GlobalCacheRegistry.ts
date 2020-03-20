import { ExpiringMap } from '../ExpiringMap';
import { CacheRegistry } from './CacheRegistry';

export class GlobalCacheRegistry implements CacheRegistry {
    public getOrInit(target: any, methodName: string): ExpiringMap<string, any> {
        const key = `__cacheable_map_${methodName}`;

        if (!target.hasOwnProperty(key)) {
            Object.defineProperty(target, key, <PropertyDescriptor>{
                configurable: false,
                enumerable: false,
                writable: false,
                value: new ExpiringMap<string, any>()
            });
        }
        return target[key];
    }
}
