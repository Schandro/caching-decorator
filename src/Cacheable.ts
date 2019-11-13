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

async function cacheOriginalMethod(originalMethod: Method, options: CacheableOptions, args: any[]): Promise<any> {

    const map = CacheRegistryProvider.forScope(options.scope!).getOrInit(this, originalMethod);
    const cacheKey = buildCacheKey(args, `${this.constructor.name}::${originalMethod.name}`);

    if (map.has(cacheKey)) {
        return map.get(cacheKey);
    } else {
        const returnValue = await originalMethod.apply(this, args as any);
        if (returnValue != undefined || options.cacheUndefined === true) {
            map.set(cacheKey, returnValue, options.ttl);
        }
        return returnValue;
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
