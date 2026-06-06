// 粒子系统:火焰/电流/爆炸/飘字
(function() {
    window.ShelterTD = window.ShelterTD || {};
    const { Pool } = window.ShelterTD;
    const MAX_PARTICLES = 50;

    function createParticle() {
        return {
            type: 'spark', // spark/fire/elec/smoke/text/spike_hit/grid_pulse
            x: 0, y: 0, vx: 0, vy: 0,
            life: 0, maxLife: 0,
            size: 1, color: '#fff',
            text: '', font: '8px monospace',
            gravity: 0
        };
    }
    function resetParticle(p) {
        p.text = '';
        p.gravity = 0;
    }

    class ParticleSystem {
        constructor() {
            this.pool = new Pool(createParticle, resetParticle, 32);
        }

        _spawn(opts) {
            if (this.pool.active.length >= MAX_PARTICLES) return null;
            const p = this.pool.acquire();
            Object.assign(p, opts);
            return p;
        }

        spark(x, y, dir) {
            for (let i = 0; i < 3; i++) {
                this._spawn({
                    type: 'spark', x, y,
                    vx: dir * (40 + Math.random() * 60),
                    vy: (Math.random() - 0.5) * 60,
                    life: 0, maxLife: 0.25 + Math.random() * 0.15,
                    size: 1, color: '#ffaa30', gravity: 0
                });
            }
        }

        muzzle(x, y, dir) {
            this._spawn({
                type: 'flash', x, y, vx: 0, vy: 0,
                life: 0, maxLife: 0.08,
                size: 3, color: '#ffe070'
            });
            this.spark(x + dir * 4, y, dir);
        }

        fire(x, y, dir) {
            // 火焰流喷射
            for (let i = 0; i < 2; i++) {
                this._spawn({
                    type: 'fire', x, y: y + (Math.random() - 0.5) * 3,
                    vx: dir * (60 + Math.random() * 30),
                    vy: -10 - Math.random() * 20,
                    life: 0, maxLife: 0.4 + Math.random() * 0.2,
                    size: 2 + Math.random() * 2, color: '#ffd040'
                });
            }
        }

        elec(x1, y1, x2, y2) {
            // 电弧:用几段闪烁的小段
            const steps = 4;
            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                const ex = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 4;
                const ey = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 4;
                this._spawn({
                    type: 'elec', x: ex, y: ey,
                    vx: 0, vy: 0,
                    life: 0, maxLife: 0.12,
                    size: 1, color: i % 2 === 0 ? '#ffffff' : '#7ee0ff'
                });
            }
        }

        spikeHit(x, y) {
            for (let i = 0; i < 4; i++) {
                this._spawn({
                    type: 'spike_hit',
                    x: x + (Math.random() - 0.5) * 8,
                    y: y + (Math.random() - 0.5) * 4,
                    vx: (Math.random() - 0.5) * 16,
                    vy: -18 - Math.random() * 16,
                    life: 0,
                    maxLife: 0.18 + Math.random() * 0.08,
                    size: 2 + Math.random() * 2,
                    color: i % 2 === 0 ? '#ffb24a' : '#ff7040'
                });
            }
        }

        gridPulse(x, y) {
            this._spawn({
                type: 'grid_pulse',
                x,
                y,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 0.22,
                size: 8,
                color: '#7ee0ff'
            });
        }

        explosion(x, y) {
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.3;
                this._spawn({
                    type: 'smoke', x, y,
                    vx: Math.cos(angle) * 30,
                    vy: Math.sin(angle) * 30 - 10,
                    life: 0, maxLife: 0.5 + Math.random() * 0.3,
                    size: 2, color: '#ff7020'
                });
            }
        }

        damage(x, y, txt, color) {
            this._spawn({
                type: 'text', x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: -40,
                life: 0, maxLife: 0.8,
                text: txt || '-1', color: color || '#ffffff',
                gravity: 30
            });
        }

        floatText(x, y, txt, color) {
            this._spawn({
                type: 'text', x, y,
                vx: 0, vy: -25,
                life: 0, maxLife: 1.0,
                text: txt, color: color || '#ffd24a',
                gravity: 0
            });
        }

        update(dt) {
            this.pool.forEach((p) => {
                p.life += dt;
                if (p.life >= p.maxLife) {
                    this.pool.release(p);
                    return;
                }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.gravity) p.vy += p.gravity * dt;
                if (p.type === 'fire') {
                    p.vy -= 30 * dt; // 火向上飘
                }
            });
        }

        render(ctx) {
            this.pool.forEach((p) => {
                const t = p.life / p.maxLife;
                const alpha = 1 - t;
                ctx.globalAlpha = alpha;
                if (p.type === 'text') {
                    ctx.font = p.font;
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#000';
                    ctx.fillText(p.text, Math.round(p.x) + 1, Math.round(p.y) + 1);
                    ctx.fillStyle = p.color;
                    ctx.fillText(p.text, Math.round(p.x), Math.round(p.y));
                } else if (p.type === 'fire') {
                    // 火焰渐变色
                    const c = t < 0.3 ? '#ffe070' : (t < 0.6 ? '#ff7020' : '#a02020');
                    ctx.fillStyle = c;
                    const s = Math.max(1, Math.round(p.size * (1 - t * 0.5)));
                    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
                } else if (p.type === 'flash') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 1), 4, 2);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(Math.round(p.x - 1), Math.round(p.y), 2, 1);
                } else if (p.type === 'spike_hit') {
                    ctx.fillStyle = p.color;
                    const s = Math.max(1, Math.round(p.size * (1 - t * 0.35)));
                    ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - s), 2, s * 2);
                    ctx.fillRect(Math.round(p.x - s), Math.round(p.y - 1), s * 2, 2);
                } else if (p.type === 'grid_pulse') {
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 2;
                    const r = 5 + t * 12;
                    ctx.beginPath();
                    ctx.arc(Math.round(p.x), Math.round(p.y), r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(Math.round(p.x), Math.round(p.y), Math.max(2, r - 3), 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    ctx.fillStyle = p.color;
                    const s = p.size;
                    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
                }
            });
            ctx.globalAlpha = 1;
        }

        clear() {
            this.pool.releaseAll();
        }

        get count() { return this.pool.size; }
    }

    window.ShelterTD.ParticleSystem = ParticleSystem;
})();
