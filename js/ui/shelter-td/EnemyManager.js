(function() {
    window.ShelterTD = window.ShelterTD || {};
    const { Pool, AssetLoader } = window.ShelterTD;
    const MAX_ENEMIES = 18;

    const ENEMY_TYPES = [
        { hp: 4, speed: 20 },
        { hp: 3, speed: 38 },
        { hp: 12, speed: 14 }
    ];

    function createEnemy() {
        return {
            x: 0,
            y: 0,
            hp: 1,
            maxHp: 1,
            speed: 18,
            dir: 1,
            type: 0,
            frame: 0,
            frameTimer: 0,
            dying: false,
            dyingTimer: 0,
            deathFrame: 0,
            alive: false,
            flashTimer: 0,
            giant: false,
            scale: 1,
            assaulting: false,
            attackTimer: 0,
            attackCooldown: 1.15,
            attackAnim: 0,
            attackPoseTimer: 0,
            breachAttackCount: 0,
            forcedExpire: false
        };
    }

    function resetEnemy(e) {
        e.alive = false;
        e.dying = false;
        e.flashTimer = 0;
        e.giant = false;
        e.scale = 1;
        e.assaulting = false;
        e.attackTimer = 0;
        e.attackCooldown = 1.15;
        e.attackAnim = 0;
        e.attackPoseTimer = 0;
        e.breachAttackCount = 0;
        e.forcedExpire = false;
    }

    class EnemyManager {
        constructor(scene) {
            this.scene = scene;
            this.pool = new Pool(createEnemy, resetEnemy, 20);
            this.spawnTimer = 0;
            this.spawnInterval = 1.5;
            this.groundY = 0;
            this.leftSpawnX = 0;
            this.rightSpawnX = 0;
            this.buildingX = 0;
            this.stopRadius = 50;
            this.onKill = null;
            this.onBreachAttack = null;
            this._spawnMult = 1;
            this._progressMult = 1;
            this._maxTypeIdx = 0;
        }

        configure(opts) {
            Object.assign(this, opts);
        }

        setLevel(level) {
            const lv = Math.max(1, Number(level) || 1);
            this.spawnInterval = Math.max(0.7, 1.6 - lv * 0.08);
            this._maxTypeIdx = lv >= 7 ? 2 : (lv >= 4 ? 1 : 0);
        }

        setProgressMultiplier(multiplier) {
            this._progressMult = Math.max(0.2, Number(multiplier) || 1);
        }

        spawnRate(multiplier) {
            this._spawnMult = Math.max(0.2, Number(multiplier) || 1);
        }

        update(dt) {
            this.spawnTimer += dt;
            const speedMult = Math.max(0.2, (this._spawnMult || 1) * (this._progressMult || 1));
            const interval = Math.max(0.18, this.spawnInterval / speedMult);
            if (this.spawnTimer >= interval && this.pool.size < MAX_ENEMIES) {
                this.spawnTimer = 0;
                this._spawn();
            }

            this.pool.forEach((e) => {
                e.frameTimer += dt;
                if (e.flashTimer > 0) {
                    e.flashTimer -= dt;
                }
                if (e.attackAnim > 0) {
                    e.attackAnim = Math.max(0, e.attackAnim - dt * 3.4);
                }
                if (e.attackPoseTimer > 0) {
                    e.attackPoseTimer = Math.max(0, e.attackPoseTimer - dt);
                }

                if (e.dying) {
                    e.dyingTimer += dt;
                    e.deathFrame = Math.min(4, Math.floor(e.dyingTimer / 0.12));
                    if (e.dyingTimer > (e.giant ? 1.6 : 1.2)) {
                        this.pool.release(e);
                    }
                    return;
                }

                const frameDur = 60 / Math.max(8, e.speed) * 0.08;
                if (e.frameTimer > frameDur) {
                    e.frameTimer = 0;
                    e.frame = (e.frame + 1) & 3;
                }

                const dx = this.buildingX - e.x;
                const stopRadius = this.stopRadius + (e.giant ? 32 : 0);
                if (Math.abs(dx) > stopRadius) {
                    e.assaulting = false;
                    e.x += Math.sign(dx) * e.speed * dt;
                    e.dir = Math.sign(dx);
                } else {
                    e.assaulting = true;
                    e.dir = dx === 0 ? e.dir : Math.sign(dx);
                    e.attackTimer -= dt;
                    if (e.attackTimer <= 0) {
                        e.attackTimer = e.attackCooldown;
                        e.attackAnim = 1;
                        e.attackPoseTimer = e.giant ? 0.3 : 0;
                        this.onBreachAttack?.(e);
                        if (e.giant) {
                            e.breachAttackCount += 1;
                            if (e.breachAttackCount >= 3 && e.alive && !e.dying) {
                                this.forceExpire(e);
                            }
                        }
                    }
                }
            });
        }

        _spawn() {
            const e = this.pool.acquire();
            const fromLeft = Math.random() < 0.5;
            const giantAlive = this.pool.active.some((enemy) => enemy.alive && !enemy.dying && enemy.giant);
            const makeGiant = !giantAlive && Math.random() < 0.06;
            const type = makeGiant ? 2 : Math.floor(Math.random() * ((this._maxTypeIdx || 0) + 1));
            const cfg = ENEMY_TYPES[type] || ENEMY_TYPES[0];

            e.x = fromLeft ? this.leftSpawnX : this.rightSpawnX;
            e.y = this.groundY;
            e.type = type;
            e.giant = makeGiant;
            e.scale = makeGiant ? 5 : 1;
            e.hp = cfg.hp * (makeGiant ? 5 : 1);
            e.maxHp = e.hp;
            e.speed = cfg.speed * (makeGiant ? 0.62 : 1);
            e.dir = fromLeft ? 1 : -1;
            e.frame = 0;
            e.frameTimer = 0;
            e.dying = false;
            e.dyingTimer = 0;
            e.deathFrame = 0;
            e.flashTimer = 0;
            e.alive = true;
            e.assaulting = false;
            e.attackAnim = 0;
            e.attackPoseTimer = 0;
            e.breachAttackCount = 0;
            e.forcedExpire = false;
            e.attackCooldown = (makeGiant ? 1.5 : 1.05) + Math.random() * (makeGiant ? 0.45 : 0.35);
            e.attackTimer = e.attackCooldown * (0.45 + Math.random() * 0.35);
        }

        findNearest(fromX, side) {
            let best = null;
            let bestDist = Infinity;
            this.pool.forEach((e) => {
                if (!e.alive || e.dying) {
                    return;
                }
                const dx = e.x - fromX;
                if (side > 0 && dx <= 0) {
                    return;
                }
                if (side < 0 && dx >= 0) {
                    return;
                }
                const d = Math.abs(dx);
                if (d < bestDist) {
                    bestDist = d;
                    best = e;
                }
            });
            return best;
        }

        findThreatTarget(fromX, range, side = 0) {
            const maxRange = Math.max(0, Number(range) || 0);
            let best = null;
            let bestScore = Infinity;
            this.pool.forEach((e) => {
                if (!e.alive || e.dying) {
                    return;
                }
                const dx = e.x - fromX;
                const dist = Math.abs(dx);
                if (dist > maxRange) {
                    return;
                }
                const threat = Math.abs(this.buildingX - e.x);
                const crossed = side > 0 ? dx <= 0 : side < 0 ? dx >= 0 : false;
                const sidePenalty = crossed ? -60 : 0;
                const score = threat * 3 + dist + sidePenalty;
                if (score < bestScore) {
                    bestScore = score;
                    best = e;
                }
            });
            return best;
        }

        hitTest(x, y, radius) {
            let hit = null;
            this.pool.forEach((e) => {
                if (!e.alive || e.dying) {
                    return;
                }
                const scale = e.giant ? 5 : 1;
                const dx = e.x - x;
                const dy = (e.y - 10 * scale) - y;
                const hitRadius = radius + (e.giant ? 30 : 0);
                if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                    hit = e;
                }
            });
            return hit;
        }

        damage(enemy, dmg) {
            if (!enemy.alive || enemy.dying) {
                return;
            }
            const amount = Math.max(1, Math.round(Number(dmg) || 1));
            enemy.hp -= amount;
            enemy.flashTimer = 0.08;
            const textY = enemy.y - (enemy.giant ? 92 : 18);
            this.scene.particles?.damage(enemy.x, textY, `-${amount}`, '#ffffff');
            if (enemy.hp <= 0) {
                enemy.dying = true;
                enemy.dyingTimer = 0;
                enemy.deathFrame = 0;
                this.scene.particles?.explosion(enemy.x, enemy.y - (enemy.giant ? 38 : 8));
                this.scene.shake?.(enemy.giant ? 4 : 2, enemy.giant ? 0.24 : 0.15);
                this.onKill?.(enemy);
            }
        }

        forceExpire(enemy) {
            if (!enemy.alive || enemy.dying) {
                return;
            }
            enemy.forcedExpire = true;
            enemy.hp = 0;
            enemy.dying = true;
            enemy.dyingTimer = 0;
            enemy.deathFrame = 0;
            enemy.attackPoseTimer = 0;
            enemy.attackAnim = 0;
            this.scene.particles?.explosion(enemy.x, enemy.y - (enemy.giant ? 38 : 8));
            this.scene.shake?.(enemy.giant ? 4.5 : 2, enemy.giant ? 0.28 : 0.15);
            this.onKill?.(enemy);
        }

        forEachAlive(fn) {
            this.pool.forEach((e) => {
                if (e.alive && !e.dying) {
                    fn(e);
                }
            });
        }

        render(ctx) {
            this.pool.forEach((e) => {
                if (e.dying) {
                    this._drawEnemySprite(ctx, `corpse_${e.type}_${e.deathFrame}`, e, false);
                    return;
                }
                const name = `zombie_${e.type}_${e.frame}`;
                if (e.giant && !e.dying) this._renderGiantSprite(ctx, e);
                else this._drawEnemySprite(ctx, name, e, e.flashTimer > 0);
                this._renderHp(ctx, e);
            });
        }

        _drawEnemySprite(ctx, name, enemy, flash) {
            const scale = enemy.giant ? 5 : 1;
            const draw = flash ? AssetLoader.drawSpriteFlash : AssetLoader.drawSprite;
            const attackOffset = enemy.attackAnim > 0
                ? enemy.dir * Math.sin((1 - enemy.attackAnim) * Math.PI) * (enemy.giant ? 5 : 3)
                : 0;
            ctx.save();
            ctx.translate(Math.round(enemy.x + attackOffset), Math.round(enemy.y));
            ctx.scale(enemy.dir < 0 ? -scale : scale, scale);
            draw(ctx, name, 0, 0);
            ctx.restore();
        }

        _renderGiantSprite(ctx, e) {
            const media = this.scene.media || {};
            const isAttackPose = e.attackPoseTimer > 0;
            const sprite = e.dir < 0
                ? (isAttackPose ? media.enemyHugeRightAttack : media.enemyHugeRight)
                : (isAttackPose ? media.enemyHugeLeftAttack : media.enemyHugeLeft);
            if (!sprite || !sprite.complete || !sprite.naturalWidth) {
                this._drawEnemySprite(ctx, `zombie_${e.type}_${e.frame}`, e, e.flashTimer > 0);
                return;
            }

            const now = window.performance.now() * 0.001;
            const phase = (e.x * 0.017) + (e.dir > 0 ? 0 : Math.PI * 0.5);
            const walkPulse = Math.sin(now * 4.2 + phase);
            const bob = isAttackPose ? Math.sin(now * 18) * 0.9 : walkPulse * 2.4;
            const tilt = isAttackPose ? (e.dir > 0 ? -0.03 : 0.03) : walkPulse * 0.02;
            const attackOffset = e.attackAnim > 0
                ? e.dir * Math.sin((1 - e.attackAnim) * Math.PI) * 7
                : 0;
            const width = 124;
            const height = Math.round(width * (sprite.naturalHeight / sprite.naturalWidth));
            const drawX = -Math.round(width * 0.5);
            const drawY = -Math.round(height) + 14;

            ctx.save();
            ctx.translate(Math.round(e.x + attackOffset), Math.round(e.y + bob));
            ctx.rotate(tilt);

            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(0, 6, 38 + Math.abs(walkPulse) * 5, 10 + Math.abs(walkPulse) * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();

            if (e.flashTimer > 0) {
                ctx.globalAlpha = 0.62;
                ctx.filter = 'brightness(1.5) saturate(0.7)';
            }
            ctx.drawImage(sprite, drawX, drawY, width, height);
            ctx.restore();
        }

        _renderHp(ctx, e) {
            if (e.hp >= e.maxHp) {
                return;
            }
            const w = e.giant ? 46 : 12;
            const y = Math.round(e.y - (e.giant ? 104 : 26));
            const ratio = Math.max(0, e.hp / e.maxHp);
            ctx.fillStyle = '#1a1410';
            ctx.fillRect(Math.round(e.x - w / 2) - 1, y - 1, w + 2, 5);
            ctx.fillStyle = '#3a2820';
            ctx.fillRect(Math.round(e.x - w / 2), y, w, 3);
            ctx.fillStyle = ratio > 0.5 ? '#7ee07a' : (ratio > 0.25 ? '#ffd24a' : '#ff5040');
            ctx.fillRect(Math.round(e.x - w / 2), y, Math.round(w * ratio), 3);
        }

        clear() {
            this.pool.releaseAll();
        }
    }

    window.ShelterTD.EnemyManager = EnemyManager;
})();
