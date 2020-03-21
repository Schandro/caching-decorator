import { CacheRegistry } from './CacheRegistry';
import { ExpiringMap } from '../ExpiringMap';
import cls = require('cls-hooked');

const nameSpaceName = process.env.TYPESCRIPT_CACHEABLE_NAMESPACE || '__tsc_storage__';
const cacheRegistryKey = `__typescript_cacheable_registry__`;

export const localStorage = cls.getNamespace(nameSpaceName) || cls.createNamespace(nameSpaceName);

export class LocalStorageCacheRegistry implements CacheRegistry {
    public getOrInit(target: Object, methodName: string): ExpiringMap<string, any> {
        if (!localStorage.get(cacheRegistryKey)) {
            localStorage.set(cacheRegistryKey, new Map<string, ExpiringMap<string, any>>());
        }
        const map = localStorage.get(cacheRegistryKey);
        const dir = this.getOrInitDir(target);
        if (!dir.has(methodName)) {
            dir.add(methodName);
        }
        const key = `${target.constructor.name}__${methodName}`;
        if (!map.has(key)) {
            const values = new ExpiringMap<string, any>();
            map.set(key, values);
        }
        return map.get(key);
    }

    public getOrInitDir(target: Object): Set<string> {
        const dirKey = `${target.constructor.name}__$$`;
        const map = localStorage.get(cacheRegistryKey);
        let dir: Set<string>;
        if (map.has(dirKey)) {
            dir = map.get(dirKey);
        } else {
            dir = new Set<string>();
            map.set(dirKey, dir);
        }
        return dir;
    }
}
