import { GlobalCacheRegistry } from '@/registry/GlobalCacheRegistry';
import { LocalStorageCacheRegistry } from '@/registry/LocalCacheRegistry';
import { Scope } from '@/Scope';
import { CacheRegistry } from '@/registry/CacheRegistry';

export class CacheRegistryProvider {

    private static global = new GlobalCacheRegistry();
    private static local = new LocalStorageCacheRegistry();

    public static forScope(scope: Scope): CacheRegistry {
        switch (scope) {
            case Scope.GLOBAL:
                return CacheRegistryProvider.global;
            case Scope.LOCAL_STORAGE:
                return CacheRegistryProvider.local;
            default:
                throw new Error(`No storage factory for scope: ${scope}`);
        }
    }

}