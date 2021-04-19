import { Cacheable } from '../src/Cacheable';
import { Dwarf } from './Dwarf';

const faker = require('faker');

export class DwarfRepository {
    private isGrumpy: boolean = false;

    @Cacheable()
    public nonAsync(): number {
        for (let i = 0; i < 1000000000; i++) {}
        return 1000000000;
    }

    @Cacheable()
    public async findHappiest(): Promise<Dwarf> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(new Dwarf('Huck', 'Finn'));
            }, 100);
        });
    }

    @Cacheable()
    public async findSaddest(): Promise<Dwarf|undefined> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(undefined);
            }, 100);
        });
    }

    @Cacheable({ cacheUndefined: true })
    public async findGrumpiest(): Promise<Dwarf | null> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(null);
            }, 100);
        });
    }

    @Cacheable({ cacheUndefined: false })
    public findGrumpiestWithoutCachingNulls(): Promise<Dwarf> | null {
        if (!this.isGrumpy) {
            this.isGrumpy = true
            return null;
        } else {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(new Dwarf(`Mark`, `MyWords`));
                }, 100);
            });
        }
    }

    @Cacheable({ ttl: 1000 })
    public async findHappiestWithTimeout(): Promise<Dwarf> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(new Dwarf('Huck', 'Finn'));
            }, 100);
        });
    }

    @Cacheable()
    public async countByLastName(name: string): Promise<number> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(12);
            }, 100);
        });
    }

    @Cacheable()
    public async countByFirstAndLastName(firstName: string | null, lastName: string | undefined): Promise<number> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(1);
            }, 50);
        });
    }

    @Cacheable()
    public async findWithInterestsMatching(customer: Dwarf): Promise<Dwarf> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(new Dwarf('Huck', 'Finn'));
            }, 100);
        });
    }

    @Cacheable()
    public greetDwarf(name: string | undefined | null): string {
        return `Hello, ${name || 'dwarf'}!`;
    }
}
