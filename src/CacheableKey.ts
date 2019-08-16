export interface CacheableKey {
    cacheKey(): string;
}

export function implementsCacheableKey(object: any): object is CacheableKey {
    return 'cacheKey' in object;
}
