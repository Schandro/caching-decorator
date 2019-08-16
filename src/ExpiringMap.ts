const EventEmitter = require('events');

import { MapEntry } from '@/MapEntry';

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
        if (duration) {
            setTimeout(() => {
                this.store.delete(key);
            }, duration);
        }
        this.emit('save', key, value, duration);
    }

    public get(key: K) {
        const entity = this.store.get(key);
        return entity === undefined || entity.isExpired ? undefined : entity.data;
    }

    public has(key: K) {
        return this.store.has(key);
    }

    private clean(): void {
        this.store.forEach((value: MapEntry<V>, key: K) => {
            if (value.isExpired) {
                this.store.delete(key);
            }
        });
    }

}