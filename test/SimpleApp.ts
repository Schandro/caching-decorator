import * as express from 'express';
import { localStorage } from '@/registry/LocalCacheRegistry';
import { DwarfRepository } from './DwarfRepository';
import { Dwarf } from './Dwarf';
const Stopwatch = require('statman-stopwatch');

export const app = express();

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    localStorage.bindEmitter(req);
    localStorage.bindEmitter(res);
    localStorage.bind(next);
    return localStorage.run(() => {
        return next();
    });
});

app.get('/hello', async (req: express.Request, res: express.Response): Promise<void> => {
    const dwarfRepo = new DwarfRepository();
    const watch = new Stopwatch();
    watch.start();
    let dwarf = await dwarfRepo.findRandom();
    let time = watch.read();
    expect(time).toBeGreaterThan(100);
    watch.reset();
    watch.start();
    let anotherDwarf = await dwarfRepo.findRandom();
    expect(`${dwarf.firstName} ${dwarf.lastName}`)
        .toEqual(`${anotherDwarf.firstName} ${anotherDwarf.lastName}`);
    time = watch.read();
    expect(time).toBeLessThan(10);
    res.send({dwarf: anotherDwarf});
});

