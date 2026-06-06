// 通用对象池 - 复用对象避免 GC
(function() {
    window.ShelterTD = window.ShelterTD || {};

    class Pool {
        constructor(factory, resetFn, initialSize = 8) {
            this.factory = factory;
            this.resetFn = resetFn || (() => {});
            this.free = [];
            this.active = [];
            for (let i = 0; i < initialSize; i++) {
                this.free.push(this.factory());
            }
        }
        acquire() {
            const obj = this.free.length ? this.free.pop() : this.factory();
            this.active.push(obj);
            return obj;
        }
        release(obj) {
            const idx = this.active.indexOf(obj);
            if (idx !== -1) {
                this.active.splice(idx, 1);
                this.resetFn(obj);
                this.free.push(obj);
            }
        }
        releaseAll() {
            for (const obj of this.active) {
                this.resetFn(obj);
                this.free.push(obj);
            }
            this.active.length = 0;
        }
        forEach(fn) {
            // 反向遍历,允许在回调中 release
            for (let i = this.active.length - 1; i >= 0; i--) {
                fn(this.active[i], i);
            }
        }
        get size() { return this.active.length; }
    }

    window.ShelterTD.Pool = Pool;
})();
