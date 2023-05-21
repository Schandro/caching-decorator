export class Dwarf extends Object {
    constructor(readonly firstName: string, readonly lastName: string, readonly siblings: Dwarf[] = []) {
        super();
    }
}
