import { ExpiringMap } from '../ExpiringMap';
import { CacheRegistry } from './CacheRegistry';

const dirKey = '__cacheable_map_$$';

export class GlobalCacheRegistry implements CacheRegistry {
    public getOrInit(target: any, methodName: string): ExpiringMap<string, any> {
        const key = `__cacheable_map_${methodName}`;

        const dir = this.getOrInitDir(target);
        if (!dir.has(methodName)) {
            dir.add(methodName);
        }
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
    public getOrInitDir(target: any): Set<string> {
        if (!target.hasOwnProperty(dirKey)) {
            Object.defineProperty(target, dirKey, <PropertyDescriptor>{
                configurable: false,
                enumerable: false,
                writable: false,
                value: new Set<string>()
            });
        }
        return target[dirKey];
    }
}
