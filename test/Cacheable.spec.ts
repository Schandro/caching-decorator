import { Dwarf } from './Dwarf';
import { DwarfRepository } from './DwarfRepository';
import { app } from './SimpleApp';
import * as request from 'supertest';
import Stopwatch = require('statman-stopwatch');
import { NoArgsCacheKey, NullValueCacheKey, UndefinedValueCacheKey } from '../src/Symbols';
import { CacheableKey } from '../src/CacheableKey';
import { CacheableDwarf } from './CacheableDwarf';

describe('Cacheable()', () => {

    let dwarfRepo: DwarfRepository;

    function getGlobalCacheEntry<T>(methodName: keyof typeof dwarfRepo, cacheKey: string | symbol): T | undefined {
        const cacheableMap = (<any>dwarfRepo)['__cacheable_map_' + methodName];
        if (cacheableMap) {
            return cacheableMap.get(cacheKey);
        } else {
            return undefined;
        }
    }

    async function doAsyncCacheTest<T>(
        expected: T,
        methodName: keyof typeof dwarfRepo,
        cacheKey: string | symbol,
        beforeTime: number,
        afterTime: number,
        testExecutor: () => Promise<T>
    ) {
        // Check that the cache is empty to start with.
        let cacheEntry = getGlobalCacheEntry(methodName, cacheKey);
        expect(cacheEntry).toBe(undefined);

        const watch = new Stopwatch();
        watch.start();

        let result = await testExecutor();

        // Verify that the cache was populated
        cacheEntry = getGlobalCacheEntry(methodName, cacheKey);
        expect(cacheEntry).toEqual(expected);

        expect(result).toEqual(expected);
        const time = watch.read();
        expect(time).toBeGreaterThanOrEqual(beforeTime);
        watch.reset();
        watch.start();

        result = await testExecutor();
        expect(result).toEqual(expected);
        expect(watch.read()).toBeLessThan(afterTime);
    }

    beforeEach(() => {
        dwarfRepo = new DwarfRepository();
    });

    describe('when used with no arguments', () => {

        it('it returns the cached value', async () => {
            await doAsyncCacheTest(
                new Dwarf('Huck', 'Finn'),
                'findHappiest',
                NoArgsCacheKey,
                99,
                10,
                () => dwarfRepo.findHappiest()
            );
        });

        it('it returns the cached value for non async method', async () => {
            await doAsyncCacheTest(
                1000000000,
                'nonAsync',
                NoArgsCacheKey,
                99,
                10,
                async () => dwarfRepo.nonAsync()
            );
        });
    });

    describe('When used on a method that takes a single parameter', () => {

        function doCacheKeyErrorTest<T>(
            methodName: keyof (typeof dwarfRepo),
            testExecutor: () => T,
            expectedIndex: number = 0
        ) {
            expect(testExecutor).toThrow('Cannot cache: "DwarfRepository::' + methodName + '". ' +
                'To serve as a cache key, a parameter must be serializable to JSON, and should return a unique value. ' +
                'The argument at index ' + String(expectedIndex) + ' does not. ' +
                'Alternatively, consider providing a hash function, by implementing the CacheableKey interface.');
        }

        it('it builds a cache key by serializing a single parameter method to JSON', async () => {
            await doAsyncCacheTest(
                12,
                'countByLastName',
                '"Blues"',
                99,
                10,
                () => dwarfRepo.countByLastName('Blues')
            );
        });

        it(`does not throw an error if the argument can be serialised to JSON`, async () => {
            await doAsyncCacheTest(
                new Dwarf('Huck', 'Finn'),
                'findWithInterestsMatching',
                `{"firstName":"Barbecue","lastName":"Bob","siblings":[]}`,
                Number.NEGATIVE_INFINITY, // don't care about timing in this test
                Number.POSITIVE_INFINITY,
                () => dwarfRepo.findWithInterestsMatching(new Dwarf('Barbecue', 'Bob'))
            );
        });

        it(`does not throw an error if the argument cannot be serialised to JSON, but implements CacheableKey`, async () => {
            const brother = new CacheableDwarf('Barbecue', 'Bob');
            const sister = new CacheableDwarf(`Grillin'`, 'Greta', [brother]);
            brother.siblings.push(sister);
            await doAsyncCacheTest(
                new Dwarf('Huck', 'Finn'),
                'findWithInterestsMatching',
                `Barbecue:Bob`, // NOTE: no quotes within this string value, because of custom cache key
                Number.NEGATIVE_INFINITY, // don't care about timing in this test
                Number.POSITIVE_INFINITY,
                () => dwarfRepo.findWithInterestsMatching(brother)
            );
        });

        it(`throws an error if no hash function is provided and the method parameter:
            - Does not implement CacheableKey
            - Cannot be serialized to JSON`, () => {
            doCacheKeyErrorTest(
                'findWithInterestsMatching',
                () => {
                    // First, we create a circular reference, which can't be serialized to JSON.
                    const brother = new Dwarf('Barbecue', 'Bob');
                    const sister = new Dwarf(`Grillin'`, 'Greta', [brother]);
                    brother.siblings.push(sister);
                    // NOTE: the expected error is thrown before promise is created/returned, because it's thrown in the
                    //  the decorator.
                    dwarfRepo.findWithInterestsMatching(brother)
                }
            );
        });

        it(`supports passing an argument with value of undefined`, async () => {
            await doAsyncCacheTest(
                'Hello, dwarf!',
                'greetDwarf',
                UndefinedValueCacheKey,
                Number.NEGATIVE_INFINITY, // don't care about timing in this test
                Number.POSITIVE_INFINITY,
                async () => dwarfRepo.greetDwarf(undefined)
            );
        });

        it(`supports passing an argument with value of null`, async () => {
            await doAsyncCacheTest(
                'Hello, dwarf!',
                'greetDwarf',
                NullValueCacheKey,
                Number.NEGATIVE_INFINITY, // don't care about timing in this test
                Number.POSITIVE_INFINITY,
                async () => dwarfRepo.greetDwarf(null)
            );
        });
    });

    describe('When used on a method that takes multiple parameters', () => {

        it('it builds a cache key by serializing multiple arguments to JSON', async () => {
            await doAsyncCacheTest(
                1,
                'countByFirstAndLastName',
                '"Jasper"_"Blues"',
                50,
                10,
                () => dwarfRepo.countByFirstAndLastName('Jasper', 'Blues')
            );
        });

        it('the generated cache key handles null and undefined', async () => {
            await doAsyncCacheTest(
                1,
                'countByFirstAndLastName',
                `Symbol(null)_Symbol(undefined)`,
                50,
                10,
                () => dwarfRepo.countByFirstAndLastName(null, undefined)
            );
        });
    });

    describe(`when used with ttl option`, () => {

        it(`should expire cached items`, async (done) => {
            const watch = new Stopwatch();
            watch.start();

            let result = await dwarfRepo.findHappiestWithTimeout();
            expect(result).toEqual(new Dwarf('Huck', 'Finn'));
            const time = watch.read();
            expect(time).toBeGreaterThanOrEqual(99);

            setTimeout(async () => {
                const watch = new Stopwatch();
                watch.start();
                let ttlResult = await dwarfRepo.findHappiestWithTimeout();
                expect(ttlResult).not.toBeNull();
                expect(ttlResult).toEqual(new Dwarf('Huck', 'Finn'));
                expect(watch.read()).toBeLessThan(10);
            }, 600);

            setTimeout(async () => {
                const watch = new Stopwatch();
                watch.start();
                let ttlResult = await dwarfRepo.findHappiestWithTimeout();
                expect(ttlResult).not.toBeNull();
                expect(watch.read()).toBeGreaterThanOrEqual(99);
                done();
            }, 1200);

        });

    });

    describe('when a null or undefined value is returned from the cache', () => {

        it(`should cache this response by default`, async () => {
            await doAsyncCacheTest(
                undefined,
                'findSaddest',
                NoArgsCacheKey,
                99,
                10,
                () => dwarfRepo.findSaddest()
            );
        });

        it(`should cache this response when cacheNulls = true`, async () => {
            await doAsyncCacheTest(
                null,
                'findGrumpiest',
                NoArgsCacheKey,
                99,
                10,
                () => dwarfRepo.findGrumpiest()
            );
        });

        it(`should not cache nulls when cacheNulls = false`, async () => {
            const expected = new Dwarf(`Mark`, `MyWords`);

            // Check that the cache is empty to start with.
            let cacheEntry = getGlobalCacheEntry('findGrumpiestWithoutCachingNulls', NoArgsCacheKey);
            expect(cacheEntry).toBe(undefined);

            const watch = new Stopwatch();
            watch.start();

            let grumpy = await dwarfRepo.findGrumpiestWithoutCachingNulls();

            // Verify that the cache was not populated
            cacheEntry = getGlobalCacheEntry('findGrumpiestWithoutCachingNulls', NoArgsCacheKey);
            expect(cacheEntry).toBe(undefined);

            expect(grumpy).toBeNull();
            let time = watch.read();
            expect(time).toBeGreaterThanOrEqual(99);

            watch.reset();
            watch.start();
            grumpy = await dwarfRepo.findGrumpiestWithoutCachingNulls();

            // Verify that the cache was not populated
            cacheEntry = getGlobalCacheEntry('findGrumpiestWithoutCachingNulls', NoArgsCacheKey);
            expect(cacheEntry).toEqual(expected);

            expect(grumpy).not.toBeNull();
            expect(grumpy).toEqual(expected);
            expect(watch.read()).toBeGreaterThanOrEqual(99);
        });
    });

    describe('when the scope is local storage', () => {

        it('it should return the scoped value', async () => {

            const responses = new Set();
            const count = 7;

            function validate(response: any) {
                const fullName = `${response.dwarf.firstName} ${response.dwarf.lastName}`;
                expect(responses.has(fullName)).toBe(false);
                responses.add(fullName);
            }

            for (let i = 0; i < count; i++) {
                await request(app)
                    .get("/hello")
                    .expect(200)
                    .then(result => validate(result.body))
            }

            expect(responses.size).toEqual(count);
        });

    });

});

