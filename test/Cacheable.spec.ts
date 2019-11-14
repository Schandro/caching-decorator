import { Dwarf } from './Dwarf';
import { DwarfRepository } from './DwarfRepository';
import { app } from './SimpleApp';

const Stopwatch = require('statman-stopwatch');

const request = require('supertest');

describe('Cacheable()', () => {

    let dwarfRepo: DwarfRepository;

    function getGlobalCacheEntry<T>(methodName: keyof typeof dwarfRepo, cacheKey: string): T | undefined {
        const cacheableMap = dwarfRepo['__cacheable_map_' + methodName];
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
                '__no_args__',
                99,
                10,
                () => dwarfRepo.findHappiest()
            );
        });

        it('it returns the cached value for non async method', async () => {
            await doAsyncCacheTest(
                1000000000,
                'nonAsync',
                '__no_args__',
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
            expect(testExecutor).toThrow('Cannot cache: ' +
                'DwarfRepository::' + methodName + '. To serve as a cache key, a parameter must ' +
                'override toString, and return a unique value. The parameter at index ' + expectedIndex + ' does not. Alternatively, ' +
                'consider providing a hash function.');
        }

        it('it builds a cache key by calling toString on a single parameter method', async () => {
            await doAsyncCacheTest(
                12,
                'countByLastName',
                'Blues',
                99,
                10,
                () => dwarfRepo.countByLastName('Blues')
            );
        });

        it(`throws an error if no hash function is provided and the method parameter:
            - Does not implement CacheableKey
            - does not override toString
            `, () => {
            doCacheKeyErrorTest(
                'findWithInterestsMatching',
                () => {
                    // NOTE: the expected error is thrown before promise is created/returned, because it's thrown in the
                    //  the decorator.
                    dwarfRepo.findWithInterestsMatching(new Dwarf('Barbecue', 'Bob'))
                }
            );
        });

        it(`throws an expected error when passing an argument with value of undefined`, () => {
            doCacheKeyErrorTest(
                'greetDwarf',
                () => {
                    dwarfRepo.greetDwarf(undefined);
                }
            );
        });

        it(`throws an expected error when passing an argument with value of null`, () => {
            doCacheKeyErrorTest(
                'greetDwarf',
                () => {
                    dwarfRepo.greetDwarf(null);
                }
            );
        });
    });

    describe('When used on a method that takes multiple parameters', () => {

        it('it builds a cache key by calling toString on a multi parameter method', async () => {
            await doAsyncCacheTest(
                1,
                'countByFirstAndLastName',
                'Jasper_Blues',
                50,
                10,
                () => dwarfRepo.countByFirstAndLastName('Jasper', 'Blues')
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
                '__no_args__',
                99,
                10,
                () => dwarfRepo.findSaddest()
            );
        });

        it(`should cache this response when cacheNulls = true`, async () => {
            await doAsyncCacheTest(
                null,
                'findGrumpiest',
                '__no_args__',
                99,
                10,
                () => dwarfRepo.findGrumpiest()
            );
        });

        it(`should not cache nulls when cacheNulls = false`, async () => {
            const expected = new Dwarf(`Mark`, `MyWords`);

            // Check that the cache is empty to start with.
            let cacheEntry = getGlobalCacheEntry('findGrumpiestWithoutCachingNulls', '__no_args__');
            expect(cacheEntry).toBe(undefined);

            const watch = new Stopwatch();
            watch.start();

            let grumpy = await dwarfRepo.findGrumpiestWithoutCachingNulls();

            // Verify that the cache was not populated
            cacheEntry = getGlobalCacheEntry('findGrumpiestWithoutCachingNulls', '__no_args__');
            expect(cacheEntry).toBe(undefined);

            expect(grumpy).toBeNull();
            let time = watch.read();
            expect(time).toBeGreaterThanOrEqual(99);

            watch.reset();
            watch.start();
            grumpy = await dwarfRepo.findGrumpiestWithoutCachingNulls();

            // Verify that the cache was not populated
            cacheEntry = getGlobalCacheEntry('findGrumpiestWithoutCachingNulls', '__no_args__');
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

