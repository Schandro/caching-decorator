export class MapEntry<T> {

    private readonly expire?: number;

    constructor(readonly data: T, readonly duration?: number) {
        this.data = data;
        this.expire = duration ? (new Date()).getTime() + duration : undefined;
    }

    get isExpired(): boolean {
        return this.expire ? this.expire < (new Date()).getTime() : false;
    }
}