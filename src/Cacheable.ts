import { CacheableOptions, optionsWithDefaults } from './CacheableOptions';
import { implementsCacheableKey } from './CacheableKey';
import { CacheRegistryProvider } from './registry/CacheRegistryProvider';

export type Method = (...args: any[]) => any;

export function Cacheable(options?: CacheableOptions) {
    return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
        if (descriptor.value != undefined) {
            descriptor.value = wrap(descriptor.value, optionsWithDefaults(options));
        } else if (descriptor.get != undefined) {
            descriptor.get = wrap(descriptor.get, optionsWithDefaults(options));
        } else {
            throw new Error('Only put a Cacheable() decorator on a method or get accessor.');
        }
    };
}

function wrap(originalMethod: Method, options: CacheableOptions): Method {
    return function (...args: any[]): any {
        for (let arg of args) {
            console.log(arg.name);
        }
        return cacheOriginalMethod.apply(this, [originalMethod, options, args]);
    };
}

function cacheOriginalMethod(originalMethod: Method, options: CacheableOptions, args: any[]): any {

    const map = CacheRegistryProvider.forScope(options.scope!).getOrInit(this, originalMethod);
    const cacheKey = buildCacheKey(args, `${this.constructor.name}::${originalMethod.name}`);

    if (map.has(cacheKey)) {
        return map.get(cacheKey);
    } else {
        const returnValueOrPromise = originalMethod.apply(this, args as any);
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

function buildCacheKey(args: any[], symbolName: string): string {
    if (!args || !args.length) {
        return '__no_args__';
    }

    const strings = args.map((it: any, index: number) => {
        if (typeof it === 'object' && implementsCacheableKey(it)) {
            return it.cacheKey();
        } else {
            if (it.toString === Object.prototype.toString) {
                throw new Error('Cannot cache: ' + symbolName + '. To serve as a cache key, a parameter must ' +
                    'override toString, and return a unique value. The parameter at index ' + index + 'does not. ' +
                    'Alternatively, consider providing a hash function.');
            } else {
                return it.toString();
            }
        }
    });
    return strings.reduce((previousValue, currentValue) => `${previousValue}_${currentValue}`);
}

/**
 * In order to wait for wrapped methods that return Promises, we need to check if the returned value is a Promise.
 * However, consuming applications might be using their own Promise library (e.g. Bluebird), so we can't simply check if
 * the value is an instance of the global `Promise` object.
 * Instead, we check if the value looks like a Promise, i.e. it is an object that has a `then()` method.
 */
function isPromiseLike(value: any): value is PromiseLike<any> {
    return (
        (typeof value === 'function' || typeof value === 'object') // functions can have properties just like objects
        && value !== null // "null" values have type "object"
        && typeof value.then === 'function'
    );
}
