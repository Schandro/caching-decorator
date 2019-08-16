import { ExpiringMap } from '@/ExpiringMap';
import { CacheRegistry } from '@/registry/CacheRegistry';
import { Method } from '@/Cacheable';

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
