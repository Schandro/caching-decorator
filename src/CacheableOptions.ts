import { Scope } from './Scope';

export interface CacheableOptions {

    /**
     * A parameter defining the scope. If not specified, the default is GLOBAL. If LOCAL_STORAGE is specified
     * then the outcome will be cached within the context of a LOCAL_STORAGE namespace, for example, throughout the
     * span of an HTTP request.
     */
    scope: Scope;

    /**
     * An optional parameter specifying the time-to-live in milliseconds. If not specified ttl is indefinite. Consider
     * the memory use implications of indefinite caching.
     */
    ttl?: number;

    /**
     * Specifies how undefined/null return values are treated. The default (true) means that if the decorated method
     * returns a null or undefined value, subsequent calls with the same parameters will return null/undefined from
     * the cache.
     *
     * When false a null return value from the cache will result in the cached method body being evaluated again. Use
     * this to cache temporal values, such as fx rates where once they exist for a given date are immutable, but
     * may as yet be undefined, for a given input parameter.
     *
     */
    cacheUndefined: boolean;

}

/**
 * Returns
 * @param options
 * @return An options instance with default values initialized, given an initial options instance or null.
 */
export function optionsWithDefaults(options?: Partial<CacheableOptions>): CacheableOptions {
    return {
        scope: options && options.scope != undefined ? options.scope : 'GLOBAL',
        ttl: options && options.ttl != undefined ? options.ttl : undefined,
        cacheUndefined: options && options.cacheUndefined != undefined ? options.cacheUndefined : true,
    };
}
