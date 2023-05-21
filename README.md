# Caching Decorator

An in-memory caching (memoization) decorator for TypeScript. It will cache the results of expensive methods or property accessors, sync and async. The underlying function is wrapped to apply caching concerns.

caching-decorator is a fork of typescript-cacheable (https://www.npmjs.com/package/typescript-cacheable, https://gitlab.com/msts-public/general/typescript-cacheable). The following was changed:

-   made this library usable in the browser by removing usage of 'cls-hooked' and 'events' and the localStorage scope (not to be confused with the browser localStorage) which was implemented using 'cls-hooked' namespaces.
-   fixed return value of @Cacheable methods that return a Promise

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

The default (and currently only) scope is global. The previous examples are the equivalent of:

```typescript
@Cacheable({scope: 'GLOBAL'})
public async findHappiest(): Promise<Dwarf> {
    // etc
}
```

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

When `false` a null return value from the cache will result in the cached method body being evaluated again. Use this to cache temporal values, such as fx rates where once they exist for a given date are immutable, but may as yet be undefined. Promises that resolve as null or undefined will still be cached.

```typescript
@Cacheable({ cacheUndefined: false })
public async findGrumpiest(): Promise<Dwarf> {
}
```

# Convenience (Direct Cache Access) Methods

Sometimes you need to be able to directly manipulate the cache outside the functionality provided by the `@Cacheable()` decorator. For example, when running tests, sometimes the caching can actually get in the way.

The convenience methods are:

| Action  | Purpose                                      | GLOBAL          | Arguments                                      |
| ------- | -------------------------------------------- | --------------- | ---------------------------------------------- |
| Clear   | Clear all cache entries for an object method | `globalClear`   | target object, method name                     |
| Delete  | Delete a single cache entry                  | `globalDelete`  | target object, method name, method args        |
| Get     | Get a cached value                           | `globalGet`     | target object, method name, method args        |
| Set     | Set a cached value                           | `globalSet`     | target object, method name, method args, value |
| Methods | Return cached methods for an object          | `globalMethods` | target object                                  |
| Keys    | Return cached keys for an object method      | `globalKeys`    | target object, method                          |

## Example

Let's say we have the following method to retrieve an invoice from the database and optionally lock it:

```typescript
    public async findById(id: string, forUpdate: boolean = false): Promise<Invoice> {
        const rows = await this.persistenceManager.query(
            `select * from invoice where id = $1${forUpdate ? ' for no key update' : ''}`,
            [id]
        );
        if (rows.length === 0) {
            throw AppError.with(ErrorCode.INVALID_INVOICE);
        }
        const invoice = this.fromDB(rows[0]);
        if (forUpdate) {
            invoice.captureBeforeUpdate();
        }
        return invoice;
    }
```

Obviously our code is never going to call this method more than once for a request, but just in case we make it cacheable with the global storage cache:

```typescript
    @Cacheable({ scope: 'GLOBAL' })
    public async findById(id: string, forUpdate: boolean = false): Promise<Invoice> {
        const rows = await this.persistenceManager.query(
            `select * from invoice where id = $1${forUpdate ? ' for no key update' : ''}`,
            [id]
        );
        if (rows.length === 0) {
            throw AppError.with(ErrorCode.INVALID_INVOICE);
        }
        const invoice = this.fromDB(rows[0]);
        if (forUpdate) {
            invoice.captureBeforeUpdate();
        }
        return invoice;
    }
```

Then we think it would be a good idea if any call with `forUpdate` set to `true` would populate the cache for the same `id` value, but `forUpdate` set to `false`.

**Note**:

Because our method defines an argument with a default value (`forUpdate`) we need to set cache entries for both when the argument is populated explicitly and when it is populated by default:

```typescript
    @Cacheable({ scope: 'GLOBAL' })
    public async findById(id: string, forUpdate: boolean = false): Promise<Invoice> {
        const rows = await this.persistenceManager.query(
            `select * from invoice where id = $1${forUpdate ? ' for no key update' : ''}`,
            [id]
        );
        if (rows.length === 0) {
            throw AppError.with(ErrorCode.INVALID_INVOICE);
        }
        const invoice = this.fromDB(rows[0]);
        if (forUpdate) {
            invoice.captureBeforeUpdate();
            globalSet(this, 'findById', [id], invoice);
            globalSet(this, 'findById', [id, false], invoice);
        }
        return invoice;
    }
```

We could do something similar in the `update` method. The `update` method itself would not use the `@Cacheable()` decorator but after the update completes it would directly populate/update the cache for the `findById` method to avoid any subsequent database round trip.

# LICENSE

This project is licensed under [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)
