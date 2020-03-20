import { CacheableOptions, optionsWithDefaults } from './CacheableOptions';
import { implementsCacheableKey } from './CacheableKey';
import { CacheRegistryProvider } from './registry/CacheRegistryProvider';
import { UncacheableArgumentError, UncacheablePropertyError } from './Errors';
import { NoArgsCacheKey, NullValueCacheKey, UndefinedValueCacheKey } from './Symbols';
import { Method } from './Types';

export function globalClear(target: Object, methodName: string): void {
    const map = CacheRegistryProvider.forScope('GLOBAL').getOrInit(target, methodName);
    map.clear();
}

export function localStorageClear(target: Object, methodName: string): void {
    const map = CacheRegistryProvider.forScope('LOCAL_STORAGE').getOrInit(target, methodName);
    map.clear();
}

export function globalDelete(target: Object, methodName: string, args: any[]): void {
    const map = CacheRegistryProvider.forScope('GLOBAL').getOrInit(target, methodName);
    const key = buildCacheKey(args, `${target.constructor.name}::${methodName}`);
    map.delete(key);
}

export function localStorageDelete(target: Object, methodName: string, args: any[]): void {
    const map = CacheRegistryProvider.forScope('LOCAL_STORAGE').getOrInit(target, methodName);
    const key = buildCacheKey(args, `${target.constructor.name}::${methodName}`);
    map.delete(key);
}

export function globalGet(target: Object, methodName: string, args: any[]): any {
    const map = CacheRegistryProvider.forScope('GLOBAL').getOrInit(target, methodName);
    const key = buildCacheKey(args, `${target.constructor.name}::${methodName}`);
    return map.get(key);
}

export function localStorageGet(target: Object, methodName: string, args: any[]): any {
    const map = CacheRegistryProvider.forScope('LOCAL_STORAGE').getOrInit(target, methodName);
    const key = buildCacheKey(args, `${target.constructor.name}::${methodName}`);
    return map.get(key);
}

export function globalSet(target: Object, methodName: string, args: any[], val: any): void {
    const map = CacheRegistryProvider.forScope('GLOBAL').getOrInit(target, methodName);
    const key = buildCacheKey(args, `${target.constructor.name}::${methodName}`);
    map.set(key, val);
}

export function localStorageSet(target: Object, methodName: string, args: any[], val: any): void {
    const map = CacheRegistryProvider.forScope('LOCAL_STORAGE').getOrInit(target, methodName);
    const key = buildCacheKey(args, `${target.constructor.name}::${methodName}`);
    map.set(key, val);
}

export function Cacheable(options?: Partial<CacheableOptions>) {
    return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
        if (descriptor.value != undefined) {
            descriptor.value = wrap(descriptor.value, optionsWithDefaults(options));
        } else if (descriptor.get != undefined) {
            descriptor.get = wrap(descriptor.get, optionsWithDefaults(options));
        } else {
            throw new UncacheablePropertyError('Only put a Cacheable() decorator on a method or get accessor.');
        }
    };
}

function wrap(originalMethod: Method, options: CacheableOptions): Method {
    return function(this: Object, ...args: any[]): any {
        return cacheOriginalMethod.apply(this, [originalMethod, options, args]);
    };
}

function cacheOriginalMethod(this: Object, originalMethod: Method, options: CacheableOptions, args: any[]): any {
    const map = CacheRegistryProvider.forScope(options.scope).getOrInit(this, originalMethod.name);
    const cacheKey = buildCacheKey(args, `${this.constructor.name}::${originalMethod.name}`);

    if (map.has(cacheKey)) {
        return map.get(cacheKey);
    } else {
        const returnValueOrPromise = originalMethod.apply(this, args);
        function returnValueHandler(returnValue: any) {
            if (returnValue != undefined || options.cacheUndefined === true) {
                map.set(cacheKey, returnValue, options.ttl);
            }
            return returnValue;
        }
        if (isPromiseLike(returnValueOrPromise)) {
            return returnValueOrPromise.then(returnValueHandler);
        } else {
            return returnValueHandler(returnValueOrPromise);
        }
    }
}

function buildCacheKey(args: any[], symbolName: string): string | symbol {
    if (!args || !args.length) {
        return NoArgsCacheKey;
    }

    const argCacheKeys = args.map((it: any, index: number) => {
        if (it === null) {
            return NullValueCacheKey;
        } else if (it === undefined) {
            return UndefinedValueCacheKey;
        } else if (typeof it === 'object' && implementsCacheableKey(it)) {
            return it.cacheKey();
        } else {
            try {
                // Serialise all values to JSON. This helps us differentiate between the number 4 and the string "4".
                // Also, boolean true from string "true".
                return JSON.stringify(it);
            } catch {
                throw new UncacheableArgumentError(
                    [
                        'Cannot cache: "' + symbolName + '".',
                        'To serve as a cache key, a parameter must be serializable to JSON,',
                        'and should return a unique value.',
                        'The argument at index ' + index + ' does not.',
                        'Alternatively, consider providing a hash function, by implementing the CacheableKey interface.'
                    ].join(' ')
                );
            }
        }
    });
    if (argCacheKeys.length === 1) {
        return argCacheKeys[0]; // If it's a single symbol, we want to return it as the single cache key.
    } else {
        return argCacheKeys.reduce((previousValue, currentValue) => `${String(previousValue)}_${String(currentValue)}`);
    }
}

/**
 * In order to wait for wrapped methods that return Promises, we need to check if the returned value is a Promise.
 * However, consuming applications might be using their own Promise library (e.g. Bluebird), so we can't simply check if
 * the value is an instance of the global `Promise` object.
 * Instead, we check if the value looks like a Promise, i.e. it is an object that has a `then()` method.
 */
function isPromiseLike(value: any): value is PromiseLike<any> {
    return (
        (typeof value === 'function' || typeof value === 'object') && // functions can have properties just like objects
        value !== null && // "null" values have type "object"
        typeof value.then === 'function'
    );
}
