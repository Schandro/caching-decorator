# Typescript Cacheable

An in-memory caching (memoization) decorator for TypeScript. It will cache the results of expensive methods or property accessors. The underlying function is wrapped to apply 
caching concerns. 

# Quick Start 

Apply the decorator to cache long-running (or high compute cost) methods or getters. 

In the example below, the first invocation will take 100ms. Subsequent invocations will take 1-2ms. The result will be cached globally, until the end of time, as long as the owning object lives.  

```typescript
@Cacheable()
public async findHappiest(): Promise<Dwarf> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(new Dwarf('Huck', 'Finn'));
        }, 100);
    });
} 
```

## Methods with Parameters

### When the type of each parameter can be serialized to JSON . . .

If the parameters can be serialized to JSON, simply apply the decorator: 

```typescript
@Cacheable()
public async countByLastName(name: string): Promise<number> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(12);
        }, 100);
    });
}
```

Subsequent invocations for the same set of arguments will return the cached value. Values will be cached globally, until the end of time - consider the memory implications! For example, there should be a finite set of possible argument values.   

Note that argument values of `undefined` are supported, even though `undefined` is not a valid JSON value. (`undefined` within objects is still not supported.)

### When the cache key can't be inferred . . .

If the argument cannot be serialized to JSON (perhaps to due circular references) and the cache key can't be inferred, parameters can implement the `CacheableKey` interface: 

```typescript
export class WeatherConditions implements CacheableKey {

    cacheKey(): string {
        return `${this.temperature}:${this.humidity}`;
    }

}
```

The `cacheKey` should be unique, given state of the instance. Now `WeatherConditions` can serve as a cache key, alongside other arguments if required: 

```typescript
@Cacheable()
public async findAdaptedFor(weather: WeatherConditions): Promise<Dwarf> {
   //
}
```

# Scopes 

## Global 

The default scope is global. The previous examples are the equivalent of: 

```typescript
@Cacheable({scope: 'GLOBAL'})
public async findHappiest(): Promise<Dwarf> {
    // etc
} 
```

## Local 

TypeScript cacheable integrates with [cls-hooked](https://github.com/jeff-lewis/cls-hooked) to provide caching scoped to the call-chain, such as the current http request in a web app. 

### Example:

The first invocation to the method below, _within the current http request_, will compute a new value, after which the cached value will be returned. 

```typescript
@Cacheable({ scope: 'LOCAL_STORAGE' })
public async findCompanion(): Promise<Dwarf> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const dwarf = new Dwarf(faker.name.firstName(), faker.name.lastName());
            resolve(dwarf);
        }, 100);
    });
}
```

Local storage must be activated to establish the call-chain.  

### Activating Local Storage in [Express](https://expressjs.com/)

To be able to use local storage in an express app, bind it to http requests, as follows: 

```typescript
const nameSpaceName = process.env.TYPESCRIPT_CACHEABLE_NAMESPACE || '__tsc_storage__';
export const localStorage = cls.getNamespace(nameSpaceName) || cls.createNamespace(nameSpaceName);
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    localStorage.bindEmitter(req);
    localStorage.bindEmitter(res);
    localStorage.bind(next);
    return localStorage.run(() => {
        return next();
    });
});
```

### Activating Local Storage in [NestJS](https://nestjs.com/)

In a NestJS app, http scoped caching can be enabled as follows: 

```typescript
/**
 * Wrap local storage to make it injectable.
 */
@Injectable()
export class LocalStorage {

    public static instance = cls.createNamespace('__tsc_storage__');

    constructor() {
    }
    
    private get<T>(key: string): T {
        return LocalStorage.instance.get(key);
    }

    private set<T>(key: string, object: T): void {
        LocalStorage.instance.set(key, object);
    }

}

@Injectable()
export class LocalStorageMiddleware implements NestMiddleware {

    public use(req: express.Request, res: express.Response, next: express.NextFunction) {
        LocalStorage.instance.bindEmitter(req);
        LocalStorage.instance.bindEmitter(res);
        LocalStorage.instance.bind(next);
        return LocalStorage.instance.run(() => {

            return next();
        });
    }
}
```

Follow the same pattern as above for your own web stack. Open an issue if you need help. 

# Time to Live 

By default, cached values live indefinitely within the applicable scope. Expiration can be enabled using the time to live option. Example: 

```typescript
@Cacheable({ ttl: 1000 })
public async findGrumpiest(): Promise<Dwarf> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(new Dwarf('Huck', 'Finn'));
        }, 100);
    });
}
```
  
Time to live is specified in milliseconds. 

# Null/Undefined Behavior

The `cacheUndefined` option specifies how undefined/null return values are treated. 

The default (true) means that if the cached method returns a null or undefined value, subsequent calls with the same parameters will return null/undefined from the cache, without invoking the underlying method again. 

When `false` a null return value from the cache will result in the cached method body being evaluated again. Use this to cache temporal values, such as fx rates where once they exist for a given date are immutable, but may as yet be undefined.
                                 
```typescript
@Cacheable({ cacheUndefined: false })
public async findGrumpiest(): Promise<Dwarf> {    
}
```

# Be Involved

TypeScript Cacheable is maintained by [MSTS](https://www.msts.com/en). The organization is an innovator in the fintech space and provides the leading B2B payment experience. We're hiring, by the way! 

Contributions are very welcome.    

 

# LICENSE 

TypeScript cacheable is licensed under [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)
