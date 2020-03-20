const EventEmitter = require('events');

import { MapEntry } from './MapEntry';

export class ExpiringMap<K, V> extends EventEmitter {
    private store: Map<K, MapEntry<V>>;

    constructor() {
        super();
        this.store = new Map<K, MapEntry<V>>();
        this.on('save', (args: any[]) => {
            this.clean();
        });
    }

    public set(key: K, value: V, duration?: number) {
        const entity = new MapEntry(value, duration);
        this.store.set(key, entity);
        this.emit('save', key, value, duration);
    }

    public get(key: K) {
        const entity = this.store.get(key);
        if (entity === undefined) {
            return undefined;
        }
        if (entity.isExpired) {
            this.store.delete(key);
            return undefined;
        }
        return entity.data;
    }

    public has(key: K) {
        return this.store.has(key) && !this.store.get(key)?.isExpired;
    }

    public delete(key: K) {
        if (this.store.has(key)) {
            this.store.delete(key);
        }
    }

    public clear() {
        this.store.clear();
    }

    public get size(): number {
        return this.store.size;
    }

    private clean(): void {
        this.store.forEach((value: MapEntry<V>, key: K) => {
            if (value.isExpired) {
                this.store.delete(key);
            }
        });
    }
}
