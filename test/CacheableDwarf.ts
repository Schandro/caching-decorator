import { CacheableKey } from '@/CacheableKey';
import { Dwarf } from './Dwarf';

export class CacheableDwarf extends Dwarf implements CacheableKey {

    cacheKey(): string {
        return `${this.firstName}:${this.lastName}`;
    }

}