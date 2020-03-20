import * as express from 'express';
import { localStorage } from '../src/registry/LocalCacheRegistry';
import { localStorageClear, localStorageDelete, localStorageSet, localStorageGet } from '../src/Cacheable';
import { DwarfRepository } from './DwarfRepository';
import { ExpiringMap } from '../src/ExpiringMap';
import { Dwarf } from './Dwarf';

const Stopwatch = require('statman-stopwatch');

export const app = express();

function localCache(target: Object, method: string): ExpiringMap<string, any> {
    const cacheRegistryKey = `__typescript_cacheable_registry__`;
    const map = <Map<string, any>>localStorage.get(cacheRegistryKey);
    const mapKey = `${target.constructor.name}__${method}`;
    return map.get(mapKey);
}

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    localStorage.bindEmitter(req);
    localStorage.bindEmitter(res);
    localStorage.bind(next);
    return localStorage.run(() => {
        return next();
    });
});

app.get(
    '/hello',
    async (req: express.Request, res: express.Response): Promise<void> => {
        const dwarfRepo = new DwarfRepository();
        const watch = new Stopwatch();
        watch.start();
        let dwarf = await dwarfRepo.findRandom();
        let time = watch.read();
        expect(time).toBeGreaterThanOrEqual(99);
        watch.reset();
        watch.start();
        let anotherDwarf = await dwarfRepo.findRandom();
        expect(`${dwarf.firstName} ${dwarf.lastName}`).toEqual(`${anotherDwarf.firstName} ${anotherDwarf.lastName}`);
        time = watch.read();
        expect(time).toBeLessThan(10);
        const theAnswer = await dwarfRepo.findTheAnswer();
        expect(theAnswer).not.toEqual(dwarf);
        res.send({ dwarf: anotherDwarf });
    }
);

app.get(
    '/cleartest',
    async (req: express.Request, res: express.Response): Promise<void> => {
        const dwarfRepo = new DwarfRepository();
        const names: string[] = ['doofus', 'dilroy'];
        let dwarf = await dwarfRepo.findRandom();
        for (let i = 0; i < 2; i++) {
            for (const name of names) {
                dwarf = await dwarfRepo.findUncle(name);
            }
        }
        for (const method of ['findRandom', 'findUncle']) {
            const cache = localCache(dwarfRepo, method);
            expect(cache.size).toBeGreaterThan(0);
            localStorageClear(dwarfRepo, method);
            expect(cache.size).toEqual(0);
        }
        res.send({ ok: true });
    }
);

app.get(
    '/deletetest',
    async (req: express.Request, res: express.Response): Promise<void> => {
        const dwarfRepo = new DwarfRepository();
        const names: string[] = ['doofus', 'dilroy'];
        let dwarf = await dwarfRepo.findRandom();
        for (let i = 0; i < 2; i++) {
            for (const name of names) {
                dwarf = await dwarfRepo.findUncle(name);
            }
        }
        let cache: ExpiringMap<string, any>;
        cache = localCache(dwarfRepo, 'findRandom');
        expect(cache.size).toEqual(1);
        localStorageDelete(dwarfRepo, 'findRandom', []);
        expect(cache.size).toEqual(0);
        cache = localCache(dwarfRepo, 'findUncle');
        let numKeys = names.length;
        for (const name of names) {
            expect(cache.size).toEqual(numKeys);
            localStorageDelete(dwarfRepo, 'findUncle', [name]);
            --numKeys;
            expect(cache.size).toEqual(numKeys);
        }
        res.send({ ok: true });
    }
);

app.get(
    '/settest',
    async (req: express.Request, res: express.Response): Promise<void> => {
        const dwarfRepo = new DwarfRepository();
        const newDwarf = new Dwarf('horrendo', 'revolver');
        const updateName = 'dilroy';
        const names: string[] = ['doofus', updateName];
        const original = new Map<string, any>();
        const dwarfRandom = await dwarfRepo.findRandom();
        localStorageSet(dwarfRepo, 'findRandom', [], newDwarf);
        const dwarfRandom2 = await dwarfRepo.findRandom();
        expect(dwarfRandom2).not.toEqual(dwarfRandom);
        expect(dwarfRandom2).toEqual(newDwarf);

        for (const name of names) {
            original.set(name, await dwarfRepo.findUncle(name));
        }
        localStorageSet(dwarfRepo, 'findUncle', [updateName], newDwarf);
        for (const name of names) {
            const cacheVal = await dwarfRepo.findUncle(name);
            if (name === updateName) {
                expect(cacheVal).toEqual(newDwarf);
            } else {
                expect(cacheVal).toEqual(original.get(name));
            }
        }
        res.send({ ok: true });
    }
);

app.get(
    '/gettest',
    async (req: express.Request, res: express.Response): Promise<void> => {
        const dwarfRepo = new DwarfRepository();
        const dwarfRandom = await dwarfRepo.findRandom();
        const dwarfRandomDirect = localStorageGet(dwarfRepo, 'findRandom', []);
        expect(dwarfRandom).toEqual(dwarfRandomDirect);
        const name = 'doofus';
        const dwarfUncle = await dwarfRepo.findUncle(name);
        const dwarfUncleDirect = localStorageGet(dwarfRepo, 'findUncle', [name]);
        expect(dwarfUncle).toEqual(dwarfUncleDirect);
        res.send({ ok: true });
    }
);
