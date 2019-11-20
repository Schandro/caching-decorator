import { ExpiringMap } from '../ExpiringMap';
import { CacheRegistry } from './CacheRegistry';
import { Method } from '../Types';

export class GlobalCacheRegistry implements CacheRegistry {

    public getOrInit(target: any, method: Method): ExpiringMap<string, any> {
        const key = `__cacheable_map_${method.name}`;

        if (!target.hasOwnProperty(key)) {
            Object.defineProperty(target, key, <PropertyDescriptor>{
                configurable: false,
                enumerable: false,
                writable: false,
                value: new ExpiringMap<string, any>(),
            });
        }
        return target[key];
    }

}
