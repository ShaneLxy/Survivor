// 瀛愬脊绯荤粺(浠庣偖濉斿彂灏?
(function() {
    window.ShelterTD = window.ShelterTD || {};
    const { Pool, AssetLoader } = window.ShelterTD;
    const MAX_PROJECTILES = 20;

    function createProjectile() {
        return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, damage: 1, target: null, active: false };
    }
    function resetProjectile(p) { p.target = null; p.active = false; }

    class ProjectileSystem {
        constructor(enemyManager, particles) {
            this.pool = new Pool(createProjectile, resetProjectile, 12);
            this.enemyManager = enemyManager;
            this.particles = particles;
        }

        fire(sx, sy, target, damage) {
            if (this.pool.active.length >= MAX_PROJECTILES) return;
            const dx = target.x - sx;
            const targetYOffset = target.giant ? 52 : 8;
            const dy = target.y - targetYOffset - sy;
            const dist = Math.hypot(dx, dy) || 1;
            const speed = 320;
            const p = this.pool.acquire();
            p.x = sx; p.y = sy;
            p.vx = (dx / dist) * speed;
            p.vy = (dy / dist) * speed;
            p.life = 0; p.maxLife = 1.0;
            p.damage = damage;
            p.target = target;
            p.active = true;
        }

        update(dt) {
            this.pool.forEach((p) => {
                if (!p.active) { this.pool.release(p); return; }
                p.life += dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.life >= p.maxLife) {
                    this.pool.release(p);
                    return;
                }
                // 纰版挒妫€娴?灏辫繎鏁屼汉
                const enemy = this.enemyManager.hitTest(p.x, p.y, 6);
                if (enemy) {
                    this.enemyManager.damage(enemy, p.damage);
                    this.particles && this.particles.spark(p.x, p.y, p.vx > 0 ? 1 : -1);
                    this.pool.release(p);
                }
            });
        }

        render(ctx) {
            this.pool.forEach((p) => {
                AssetLoader.drawSprite(ctx, 'bullet', p.x, p.y);
            });
        }

        clear() { this.pool.releaseAll(); }
    }

    window.ShelterTD.ProjectileSystem = ProjectileSystem;
})();

