import { CacheRegistry } from './CacheRegistry';
import { ExpiringMap } from '../ExpiringMap';
import { Method } from '../Cacheable';
import cls = require('cls-hooked');

const nameSpaceName = process.env.TYPESCRIPT_CACHEABLE_NAMESPACE || '__tsc_storage__';
const cacheRegistryKey = `__typescript_cacheable_registry__`;

export const localStorage = cls.getNamespace(nameSpaceName) || cls.createNamespace(nameSpaceName);

export class LocalStorageCacheRegistry implements CacheRegistry {

    public getOrInit(target: any, method: Method): ExpiringMap<string, any> {
        if (!localStorage.get(cacheRegistryKey)) {
            localStorage.set(cacheRegistryKey, new Map<any, Map<string, any>>());
        }
        const map = localStorage.get(cacheRegistryKey);
        if (!map.has(target)) {
            const values = new Map<string, any>();
            map.set(target, values);
        }
        return map.get(target);
    }

}