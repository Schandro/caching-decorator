export interface CacheableKey {
    cacheKey(): string;
}

export function implementsCacheableKey(object: any): object is CacheableKey {
    return (
        object !== null
        && object !== undefined
        && 'cacheKey' in object
        && typeof object['cacheKey'] === 'function'
        && object['cacheKey'].length === 0
    );
}
