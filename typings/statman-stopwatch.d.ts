declare module 'statman-stopwatch' {
    class Stopwatch {
        public read(): number;
        public reset(): void;
        public start(): void;
    }

    export = Stopwatch;
}
