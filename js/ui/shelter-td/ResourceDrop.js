// 资源掉落:金币/木材/稀有 - 抛物线落地后被吸进建筑
(function() {
    window.ShelterTD = window.ShelterTD || {};
    const { Pool, AssetLoader } = window.ShelterTD;
    const MAX_DROPS = 15;

    function createDrop() {
        return {
            type: 'coin', x: 0, y: 0, vx: 0, vy: 0,
            life: 0, frame: 0, frameTimer: 0,
            grounded: false, suckTimer: 0,
            targetX: 0, targetY: 0
        };
    }
    function resetDrop(d) {
        d.grounded = false; d.suckTimer = 0;
    }

    class ResourceDrop {
        constructor(particles, building) {
            this.pool = new Pool(createDrop, resetDrop, 12);
            this.particles = particles;
            this.building = building;
        }

        drop(x, y, lootType) {
            if (this.pool.active.length >= MAX_DROPS) return;
            // 加权随机决定具体类型
            // lootType: 'normal' (coin/wood) 或 'rare'
            let type = 'coin';
            if (lootType === 'rare') type = 'rare';
            else {
                const r = Math.random();
                if (r < 0.6) type = 'coin';
                else if (r < 0.92) type = 'wood';
                else type = 'rare';
            }
            const d = this.pool.acquire();
            d.type = type;
            d.x = x; d.y = y - 6;
            d.vx = (Math.random() - 0.5) * 80;
            d.vy = -80 - Math.random() * 40;
            d.life = 0;
            d.frame = 0;
            d.frameTimer = 0;
            d.grounded = false;
            d.suckTimer = 0;
        }

        update(dt, groundY) {
            this.pool.forEach((d) => {
                d.life += dt;
                d.frameTimer += dt;
                if (d.frameTimer > 0.12) {
                    d.frameTimer = 0;
                    d.frame = (d.frame + 1) & 3;
                }

                if (!d.grounded) {
                    d.x += d.vx * dt;
                    d.y += d.vy * dt;
                    d.vy += 280 * dt;
                    if (d.y >= groundY) {
                        d.y = groundY;
                        d.grounded = true;
                        d.vx = 0; d.vy = 0;
                    }
                } else {
                    // 落地 1.2 秒后被吸向建筑
                    if (d.life > 1.2) {
                        d.suckTimer += dt;
                        const tx = this.building.x;
                        const ty = this.building.y - 30;
                        const dx = tx - d.x;
                        const dy = ty - d.y;
                        const dist = Math.hypot(dx, dy);
                        const speed = 120 + d.suckTimer * 200;
                        if (dist < 6) {
                            // 到达建筑,飘字 + 释放
                            this.particles && this.particles.floatText(d.x, d.y, '+1', this._color(d.type));
                            this.pool.release(d);
                            return;
                        }
                        d.x += (dx / dist) * speed * dt;
                        d.y += (dy / dist) * speed * dt;
                    }
                    // 超时清理
                    if (d.life > 5) this.pool.release(d);
                }
            });
        }

        _color(type) {
            if (type === 'coin') return '#ffd24a';
            if (type === 'wood') return '#c88040';
            return '#e0b0ff';
        }

        render(ctx) {
            this.pool.forEach((d) => {
                let name = 'coin_0';
                if (d.type === 'coin') name = `coin_${d.frame & 3}`;
                else if (d.type === 'wood') name = 'wood';
                else name = `rare_${d.frame & 1}`;
                AssetLoader.drawSprite(ctx, name, d.x, d.y);
            });
        }

        clear() { this.pool.releaseAll(); }
    }

    window.ShelterTD.ResourceDrop = ResourceDrop;
})();
