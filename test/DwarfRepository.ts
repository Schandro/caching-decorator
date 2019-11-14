import { Cacheable } from '../src/Cacheable';
import { Dwarf } from './Dwarf';
import { Scope } from '../src/Scope';

const faker = require('faker');

export class DwarfRepository {

    private isGrumpy: boolean = false;

    @Cacheable()
    public nonAsync(): number {
        for (let i = 0; i < 1000000000; i++) {
        }
        return 1000000000;
    }

    @Cacheable()
    public async findHappiest(): Promise<Dwarf> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(new Dwarf('Huck', 'Finn'));
            }, 100);
        });
    }

    @Cacheable()
    public async findSaddest(): Promise<Dwarf> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(undefined);
            }, 100);
        });
    }

    @Cacheable({ cacheUndefined: true })
    public async findGrumpiest(): Promise<Dwarf> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(null);
            }, 100);
        });
    }

    @Cacheable({ cacheUndefined: false })
    public async findGrumpiestWithoutCachingNulls(): Promise<Dwarf> {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (this.isGrumpy) {
                    resolve(new Dwarf(`Mark`, `MyWords`));
                } else {
                    this.isGrumpy = true;
                    resolve(null);
                }
            }, 100);
        });
    }

    @Cacheable({ ttl: 1000 })
    public async findHappiestWithTimeout(): Promise<Dwarf> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(new Dwarf('Huck', 'Finn'));
            }, 100);
        });
    }

    @Cacheable({ scope: Scope.LOCAL_STORAGE })
    public async findRandom(): Promise<Dwarf> {
        return new Promise((resolve) => {
            setTimeout(() => {
                const dwarf = new Dwarf(faker.name.firstName(), faker.name.lastName());
                resolve(dwarf);
            }, 100);
        });
    }

    @Cacheable()
    public async countByLastName(name: string): Promise<number> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(12);
            }, 100);
        });
    }

    @Cacheable()
    public async countByFirstAndLastName(firstName: string, lastName: string): Promise<number> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(1);
            }, 50);
        });
    }

    @Cacheable()
    public async findWithInterestsMatching(customer: Dwarf): Promise<Dwarf> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(new Dwarf('Huck', 'Finn'));
            }, 100);
        });
    }

    @Cacheable()
    public greetDwarf(name: string | undefined | null): string {
        return `Hello, ${ name || 'dwarf' }!`;
    }
}
