import { Dwarf } from './Dwarf';
import { DwarfRepository } from './DwarfRepository';
import { app } from './SimpleApp';
import * as request from 'supertest';
import Stopwatch = require('statman-stopwatch');
import { NoArgsCacheKey, NullValueCacheKey, UndefinedValueCacheKey } from '../src/Symbols';
import { CacheableDwarf } from './CacheableDwarf';
import { globalClear, globalDelete, globalGet, globalSet } from '../src/Cacheable';

describe('Cacheable()', () => {
    let dwarfRepo: DwarfRepository;

    function getGlobalCacheEntry<T>(methodName: keyof typeof dwarfRepo, cacheKey: string): T | undefined {
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
        cacheKey: string,
        beforeTime: number,
        afterTime: number,
        testExecutor: () => Promise<T>
    ) {
        // Check that the cache is empty to start with.
        let cacheEntry = getGlobalCacheEntry(methodName, cacheKey);
        expect(cacheEntry).toBeUndefined();

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
            await doAsyncCacheTest(new Dwarf('Huck', 'Finn'), 'findHappiest', NoArgsCacheKey, 99, 10, () =>
                dwarfRepo.findHappiest()
            );
        });

        it('it returns the cached value for non async method', async () => {
            await doAsyncCacheTest(1000000000, 'nonAsync', NoArgsCacheKey, 99, 10, async () => dwarfRepo.nonAsync());
        });
    });

    describe('When used on a method that takes a single parameter', () => {
        function doCacheKeyErrorTest<T>(
            methodName: keyof typeof dwarfRepo,
            testExecutor: () => T,
            expectedIndex: number = 0
        ) {
            expect(testExecutor).toThrow(
                'Cannot cache: "DwarfRepository::' +
                    methodName +
                    '". ' +
                    'To serve as a cache key, a parameter must be serializable to JSON, and should return a unique value. ' +
                    'The argument at index ' +
                    String(expectedIndex) +
                    ' does not. ' +
                    'Alternatively, consider providing a hash function, by implementing the CacheableKey interface.'
            );
        }

        it('it builds a cache key by serializing a single parameter method to JSON', async () => {
            await doAsyncCacheTest(12, 'countByLastName', '"Blues"', 99, 10, () => dwarfRepo.countByLastName('Blues'));
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
            doCacheKeyErrorTest('findWithInterestsMatching', () => {
                // First, we create a circular reference, which can't be serialized to JSON.
                const brother = new Dwarf('Barbecue', 'Bob');
                const sister = new Dwarf(`Grillin'`, 'Greta', [brother]);
                brother.siblings.push(sister);
                // NOTE: the expected error is thrown before promise is created/returned, because it's thrown in the
                //  the decorator.
                dwarfRepo.findWithInterestsMatching(brother);
            });
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
            await doAsyncCacheTest(1, 'countByFirstAndLastName', '"Jasper"_"Blues"', 50, 10, () =>
                dwarfRepo.countByFirstAndLastName('Jasper', 'Blues')
            );
        });

        it('the generated cache key handles null and undefined', async () => {
            await doAsyncCacheTest(
                1,
                'countByFirstAndLastName',
                `${NullValueCacheKey}_${UndefinedValueCacheKey}`,
                50,
                10,
                () => dwarfRepo.countByFirstAndLastName(null, undefined)
            );
        });
    });

    describe(`when used with ttl option`, () => {
        async function sleep(ms: number): Promise<any> {
            return new Promise(resolve => {
                setTimeout(resolve, ms);
            });
        }

        it(`should expire cached items`, async () => {
            const watch = new Stopwatch();
            watch.start();

            let result = await dwarfRepo.findHappiestWithTimeout();
            expect(result).toEqual(new Dwarf('Huck', 'Finn'));
            const time = watch.read();
            expect(time).toBeGreaterThanOrEqual(99);

            //
            // Should be cached
            //
            watch.reset();
            watch.start();
            result = await dwarfRepo.findHappiestWithTimeout();
            expect(result).not.toBeNull();
            expect(result).toEqual(new Dwarf('Huck', 'Finn'));
            expect(watch.read()).toBeLessThan(10);

            await sleep(1000);

            //
            // Cache entry should now have expired
            //
            watch.reset();
            watch.start();
            result = await dwarfRepo.findHappiestWithTimeout();
            expect(result).not.toBeNull();
            expect(watch.read()).toBeGreaterThanOrEqual(99);
        });
    });

    describe('when a null or undefined value is returned from the cache', () => {
        it(`should cache this response by default`, async () => {
            await doAsyncCacheTest(undefined, 'findSaddest', NoArgsCacheKey, 99, 10, () => dwarfRepo.findSaddest());
        });

        it(`should cache this response when cacheNulls = true`, async () => {
            await doAsyncCacheTest(null, 'findGrumpiest', NoArgsCacheKey, 99, 10, () => dwarfRepo.findGrumpiest());
        });

        it(`should not cache nulls when cacheNulls = false`, async () => {
            const expected = new Dwarf(`Mark`, `MyWords`);

            // Check that the cache is empty to start with.
            let cacheEntry = getGlobalCacheEntry('findGrumpiestWithoutCachingNulls', NoArgsCacheKey);
            expect(cacheEntry).toBeUndefined();

            const watch = new Stopwatch();
            watch.start();

            let grumpy = await dwarfRepo.findGrumpiestWithoutCachingNulls();

            // Verify that the cache was not populated
            cacheEntry = getGlobalCacheEntry('findGrumpiestWithoutCachingNulls', NoArgsCacheKey);
            expect(cacheEntry).toBeUndefined();

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
                    .get('/hello')
                    .expect(200)
                    .then(result => validate(result.body));
            }

            expect(responses.size).toEqual(count);
        });
    });

    describe('direct cache operations', () => {
        it('can clear the global cache', async () => {
            let result: any;
            const names: string[] = ['doofus', 'dilroy'];
            for (const name of names) {
                const key = `"${name}"`;
                let cacheEntry = getGlobalCacheEntry('countByLastName', key);
                expect(cacheEntry).toBeUndefined();
                result = await dwarfRepo.countByLastName(name);
                cacheEntry = getGlobalCacheEntry('countByLastName', key);
                expect(cacheEntry).toBeDefined();
            }
            globalClear(dwarfRepo, 'countByLastName');
            for (const name of names) {
                const key = `"${name}"`;
                let cacheEntry = getGlobalCacheEntry('countByLastName', key);
                expect(cacheEntry).toBeUndefined();
            }
        });

        it('can clear the localStorage cache', async () => {
            await request(app)
                .get('/cleartest')
                .expect(200);
        });

        it('can delete a key from the global cache', async () => {
            let result: any;
            let cacheEntry: any;
            const deleteName = 'dilroy';
            const names: string[] = ['doofus', deleteName];
            cacheEntry = getGlobalCacheEntry('findHappiest', NoArgsCacheKey);
            expect(cacheEntry).toBeUndefined();
            result = await dwarfRepo.findHappiest();
            cacheEntry = getGlobalCacheEntry('findHappiest', NoArgsCacheKey);
            expect(cacheEntry).toBeDefined();
            for (const name of names) {
                const key = `"${name}"`;
                cacheEntry = getGlobalCacheEntry('countByLastName', key);
                expect(cacheEntry).toBeUndefined();
                result = await dwarfRepo.countByLastName(name);
                cacheEntry = getGlobalCacheEntry('countByLastName', key);
                expect(cacheEntry).toBeDefined();
            }
            globalDelete(dwarfRepo, 'countByLastName', [deleteName]);
            for (const name of names) {
                const key = `"${name}"`;
                const cacheEntry = getGlobalCacheEntry('countByLastName', key);
                if (name === deleteName) {
                    expect(cacheEntry).toBeUndefined();
                } else {
                    expect(cacheEntry).toBeDefined();
                }
            }
            cacheEntry = getGlobalCacheEntry('findHappiest', NoArgsCacheKey);
            expect(cacheEntry).toBeDefined();
            globalDelete(dwarfRepo, 'findHappiest', []);
            cacheEntry = getGlobalCacheEntry('findHappiest', NoArgsCacheKey);
            expect(cacheEntry).toBeUndefined();
        });

        it('can delete from the localStorage cache', async () => {
            await request(app)
                .get('/deletetest')
                .expect(200);
        });

        it('can set a value in the global cache', async () => {
            const val = new Dwarf('horrendo', 'revolver');
            const result = await dwarfRepo.findHappiest();
            globalSet(dwarfRepo, 'findHappiest', [], val);
            const result2 = await dwarfRepo.findHappiest();
            expect(result2).not.toEqual(result);
            expect(result2).toEqual(val);
            const updateName = 'dilroy';
            const names: string[] = ['doofus', updateName];
            const values = new Map<string, any>();
            for (const name of names) {
                values.set(name, await dwarfRepo.countByLastName(name));
            }
            const newValue = 42;
            globalSet(dwarfRepo, 'countByLastName', [updateName], newValue);
            for (const name of names) {
                const cached = await dwarfRepo.countByLastName(name);
                if (name === updateName) {
                    expect(cached).toEqual(newValue);
                } else {
                    expect(cached).toEqual(values.get(name));
                }
            }
        });

        it('can set a value in the localStorage cache', async () => {
            await request(app)
                .get('/settest')
                .expect(200);
        });

        it('can get a value from the global cache', async () => {
            const happiest = await dwarfRepo.findHappiest();
            const happiestDirect = globalGet(dwarfRepo, 'findHappiest', []);
            expect(happiest).toEqual(happiestDirect);
            const name = 'dilroy';
            const count = await dwarfRepo.countByLastName(name);
            const countDirect = globalGet(dwarfRepo, 'countByLastName', [name]);
            expect(count).toEqual(countDirect);
        });

        it('can get a value from the localStorage cache', async () => {
            await request(app)
                .get('/gettest')
                .expect(200);
        });
    });
});
