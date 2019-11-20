import { GlobalCacheRegistry } from './GlobalCacheRegistry';
import { LocalStorageCacheRegistry } from './LocalCacheRegistry';
import { Scope } from '../Scope';
import { CacheRegistry } from './CacheRegistry';
import { UnrecognizedScopeError } from '../Errors';

/**
 * This makes it a compile-time error to pass an unrecognised scope. It will throw a runtime error if the runtime
 * value is unrecognized.
 */
function assertNever(scope: never): never {
    throw new UnrecognizedScopeError(`No storage factory for scope: ${scope}`);
}

export class CacheRegistryProvider {

    private static global = new GlobalCacheRegistry();
    private static local = new LocalStorageCacheRegistry();

    public static forScope(scope: Scope): CacheRegistry {
        switch (scope) {
            case 'GLOBAL':
                return CacheRegistryProvider.global;
            case 'LOCAL_STORAGE':
                return CacheRegistryProvider.local;
            default:
                return assertNever(scope);
        }
    }

}
