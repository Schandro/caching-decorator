import { Dwarf } from './Dwarf';
import { DwarfRepository } from './DwarfRepository';
import { app } from './SimpleApp';

const Stopwatch = require('statman-stopwatch');

const request = require('supertest');

describe('Cacheable()', () => {

    let customerRepo: DwarfRepository;

    function getGlobalCacheEntry<T>(methodName: string, cacheKey): T | undefined {
        const cacheableMap = customerRepo['__cacheable_map_' + methodName];
        if (cacheableMap) {
            return cacheableMap.get(cacheKey);
        } else {
            return undefined;
        }
    }

    beforeEach(() => {
        customerRepo = new DwarfRepository();
    });

    describe('when used with no arguments', () => {

        it('it returns the cached value', async (done) => {
            const watch = new Stopwatch();
            watch.start();

            const result = await customerRepo.findHappiest();

            expect(result).toEqual(new Dwarf('Huck', 'Finn'));
            const time = watch.read();
            expect(time).toBeGreaterThan(100);

            watch.reset();
            watch.start();
            await customerRepo.findHappiest();
            expect(result).toEqual(new Dwarf('Huck', 'Finn'));
            expect(watch.read()).toBeLessThan(10);

            done();
        });

        it('it returns the cached value for non async method', (done) => {
            const expected = 1000000000;

            // Check that the cache is empty to start with.
            let cacheEntry = getGlobalCacheEntry('nonAsync', '__no_args__');
            expect(cacheEntry).toBe(undefined);

            const watch = new Stopwatch();
            watch.start();

            const result = customerRepo.nonAsync();

            expect(result).not.toBeInstanceOf(Promise); // should stay sync
            expect(result).toEqual(expected);
            const time = watch.read();
            expect(time).toBeGreaterThan(100);

            // Verify that the cache was populated
            cacheEntry = getGlobalCacheEntry('nonAsync', '__no_args__');
            expect(cacheEntry).toBe(expected);

            watch.reset();
            watch.start();
            customerRepo.nonAsync();
            expect(result).not.toBeInstanceOf(Promise);
            expect(result).toEqual(expected);
            expect(watch.read()).toBeLessThan(10);

            done();
        });
    });

    describe('When used on a method that takes a single parameters', () => {

        it('it builds a cache key by calling toString on a single parameter method', async (done) => {
            const watch = new Stopwatch();
            watch.start();

            let result = await customerRepo.countByLastName('Blues');

            expect(result).toEqual(12);
            const time = watch.read();
            expect(time).toBeGreaterThan(100);
            watch.reset();
            watch.start();

            result = await customerRepo.countByLastName('Blues');
            expect(result).toEqual(12);
            expect(watch.read()).toBeLessThan(10);

            done();
        });

        it('it builds a cache key by calling toString on a multi parameter method', async (done) => {
            const watch = new Stopwatch();
            watch.start();

            let result = await customerRepo.countByFirstAndLastName('Jasper', 'Blues');

            expect(result).toEqual(1);
            const time = watch.read();
            expect(time).toBeGreaterThan(50);
            watch.reset();
            watch.start();

            result = await customerRepo.countByFirstAndLastName('Jasper', 'Blues');
            expect(result).toEqual(1);
            expect(watch.read()).toBeLessThan(10);

            done();
        });

        it(`throws an error if no hash function is provided and the method parameter:       
            - Does not implement CacheableKey
            - does not override toString             
            `, async (done) => {
            try {
                await customerRepo.findWithInterestsMatching(new Dwarf('Barbecue', 'Bob'));
                throw new Error(`should have thrown`);
            } catch (e) {
                expect(e.message).toEqual('Cannot cache: ' +
                    'DwarfRepository::findWithInterestsMatching. To serve as a cache key, a parameter must ' +
                    'override toString, and return a unique value. The parameter at index 0does not. Alternatively, ' +
                    'consider providing a hash function.');
                done();
            }
        });

    });

    describe(`when used with ttl option`, () => {

        it(`should expire cached items`, async (done) => {
            const watch = new Stopwatch();
            watch.start();

            let result = await customerRepo.findHappiestWithTimeout();
            expect(result).toEqual(new Dwarf('Huck', 'Finn'));
            const time = watch.read();
            expect(time).toBeGreaterThan(100);

            setTimeout(async () => {
                const watch = new Stopwatch();
                watch.start();
                let ttlResult = await customerRepo.findHappiestWithTimeout();
                expect(ttlResult).not.toBeNull();
                expect(ttlResult).toEqual(new Dwarf('Huck', 'Finn'));
                expect(watch.read()).toBeLessThan(10);
            }, 600);

            setTimeout(async () => {
                const watch = new Stopwatch();
                watch.start();
                let ttlResult = await customerRepo.findHappiestWithTimeout();
                expect(ttlResult).not.toBeNull();
                expect(watch.read()).toBeGreaterThan(100);
                done();
            }, 1200);

        });

    });

    describe('when a null or undefined value is returned from the cache', () => {

        it(`should cache this response by default`, async (done) => {
            const watch = new Stopwatch();
            watch.start();

            let result = await customerRepo.findSaddest();
            expect(result).toBeUndefined();
            let time = watch.read();
            expect(time).toBeGreaterThan(100);

            watch.reset();
            watch.start();
            result = await customerRepo.findSaddest();
            expect(result).toBeUndefined();
            expect(watch.read()).toBeLessThan(10);
            done();

        });

        it(`should cache this response when cacheNulls = true`, async (done) => {
            const watch = new Stopwatch();
            watch.start();

            let grumpy = await customerRepo.findGrumpiest();
            expect(grumpy).toBeNull();
            let time = watch.read();
            expect(time).toBeGreaterThan(100);

            watch.reset();
            watch.start();
            grumpy = await customerRepo.findGrumpiest();
            expect(grumpy).toBeNull();
            expect(watch.read()).toBeLessThan(10);
            done();

        });

        it(`should not cache nulls when cacheNulls = false`, async (done) => {
            const watch = new Stopwatch();
            watch.start();

            let grumpy = await customerRepo.findGrumpiestWithoutCachingNulls();
            expect(grumpy).toBeNull();
            let time = watch.read();
            expect(time).toBeGreaterThan(100);

            watch.reset();
            watch.start();
            grumpy = await customerRepo.findGrumpiestWithoutCachingNulls();
            expect(grumpy).not.toBeNull();
            expect(grumpy).toEqual(new Dwarf(`Mark`, `MyWords`));
            expect(watch.read()).toBeGreaterThan(100);
            done();

        });
    });

    describe('when the scope is local storage', () => {

        it('it should return the scoped value', async (done) => {

            const responses = [];
            const count = 6;

            function validate(response: any) {
                responses.push(`${response.dwarf.firstName} ${response.dwarf.lastName}`);
                responses.forEach(response => {
                    if (responses.filter(it => it === response).length > 1) {
                        throw new Error(`Response: ${response} and ${it} are unexpected duplicates`);
                    }
                });
                if (responses.length === count) {
                    done();
                }
            }

            for (let i = 0; i <= count; i++) {
                request(app).get("/hello").expect(200)
                    .then(result => validate(result.body))
                    .catch(e => done(e));
            }

        });

    });

});

