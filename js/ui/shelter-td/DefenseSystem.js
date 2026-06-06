(function() {
    window.ShelterTD = window.ShelterTD || {};

    function createWeapon(id, side, x, y, range, cooldown, damage, unlockLevel) {
        return {
            id,
            side,
            x,
            y,
            range,
            cooldown,
            damage,
            unlockLevel,
            timer: 0,
            active: false,
            muzzleX: x,
            muzzleY: y
        };
    }

    class DefenseSystem {
        constructor(scene, projectiles, particles, enemies) {
            this.scene = scene;
            this.projectiles = projectiles;
            this.particles = particles;
            this.enemies = enemies;
            this.weapons = [];
            this.layout = {};
            this._boostTimer = 0;
            this._boostMult = 1;
            this.damageMultiplier = 1;
            this.attackSpeedMultiplier = 0.5;
            this.impacts = {
                spikesLeft: 0,
                gridRight: 0
            };
        }

        setLevel(level, building, tdConfig = {}) {
            this.level = Math.max(1, Number(level || 1));
            this.damageMultiplier = Math.max(0.1, Number(tdConfig.weaponDamageMultiplier) || 1);
            this.attackSpeedMultiplier = Math.max(0.1, Number(tdConfig.weaponAttackSpeedMultiplier) || 0.5);
            const bx = building.x;
            const by = building.y;
            this.weapons = [
                createWeapon('turret_left', -1, bx - 54, by - 56, 150, 0.55, 2, 1),
                createWeapon('turret_right', 1, bx + 54, by - 56, 150, 0.55, 2, 1),
                createWeapon('spikes_left', -1, bx - 98, by + 2, 72, 0.42, 2, 2),
                createWeapon('grid_right', 1, bx + 98, by + 2, 76, 0.9, 3, 4)
            ];
            this.impacts.spikesLeft = 0;
            this.impacts.gridRight = 0;
            for (const weapon of this.weapons) {
                weapon.active = this.level >= weapon.unlockLevel;
                this._applyLayout(weapon);
            }
        }

        setWeaponLayout(layout) {
            this.layout = layout || {};
            for (const weapon of this.weapons) {
                this._applyLayout(weapon);
            }
        }

        _applyLayout(weapon) {
            const layout = this.layout?.[weapon.id];
            if (!layout) {
                return;
            }
            if (Number.isFinite(layout.x)) weapon.x = layout.x;
            if (Number.isFinite(layout.y)) weapon.y = layout.y;
            if (Number.isFinite(layout.range)) weapon.range = layout.range;
            if (Number.isFinite(layout.muzzleX)) weapon.muzzleX = layout.muzzleX;
            if (Number.isFinite(layout.muzzleY)) weapon.muzzleY = layout.muzzleY;
        }

        boost(mult, duration) {
            this._boostTimer = Math.max(this._boostTimer, duration || 0);
            this._boostMult = Math.max(this._boostMult || 1, mult || 1);
        }

        getRenderableWeapons() {
            return this.weapons.filter((weapon) => weapon.active);
        }

        _getCooldown(weapon) {
            const speed = Math.max(0.1, (this._boostMult || 1) * this.attackSpeedMultiplier);
            return weapon.cooldown / speed;
        }

        _getDamage(weapon) {
            return Math.max(1, Math.round(weapon.damage * this.damageMultiplier));
        }

        update(dt) {
            if (this._boostTimer > 0) {
                this._boostTimer -= dt;
                if (this._boostTimer <= 0) {
                    this._boostTimer = 0;
                    this._boostMult = 1;
                }
            }

            this.impacts.spikesLeft = Math.max(0, this.impacts.spikesLeft - dt * 6);
            this.impacts.gridRight = Math.max(0, this.impacts.gridRight - dt * 5);

            for (const weapon of this.weapons) {
                if (!weapon.active) {
                    continue;
                }
                weapon.timer -= dt;
                if (weapon.timer > 0) {
                    continue;
                }
                const cooldown = this._getCooldown(weapon);
                const damage = this._getDamage(weapon);

                if (weapon.id === 'turret_left' || weapon.id === 'turret_right') {
                    const target = this.enemies.findThreatTarget(weapon.x, weapon.range, weapon.side);
                    if (target) {
                        this.projectiles.fire(weapon.muzzleX, weapon.muzzleY, target, damage);
                        this.particles.muzzle(weapon.muzzleX, weapon.muzzleY, weapon.side);
                        weapon.timer = cooldown;
                    } else {
                        weapon.timer = 0.08;
                    }
                    continue;
                }

                if (weapon.id === 'spikes_left') {
                    let hit = false;
                    this.enemies.forEachAlive((enemy) => {
                        const bodyRange = enemy.giant ? 46 : 0;
                        if (Math.abs(enemy.x - weapon.x) <= weapon.range + bodyRange && Math.abs(enemy.y - weapon.y) < 42) {
                            this.enemies.damage(enemy, damage);
                            this.particles.damage(enemy.x, enemy.y - (enemy.giant ? 94 : 24), '\u523a\u51fb', '#ffb05a');
                            this.particles.spikeHit(enemy.x, enemy.y - 12);
                            hit = true;
                        }
                    });
                    if (hit) {
                        this.impacts.spikesLeft = 1;
                        this.scene.shake?.(1.5, 0.08);
                    }
                    weapon.timer = cooldown;
                    continue;
                }

                if (weapon.id === 'grid_right') {
                    let hitCount = 0;
                    this.enemies.forEachAlive((enemy) => {
                        if (hitCount >= 3) {
                            return;
                        }
                        const bodyRange = enemy.giant ? 46 : 0;
                        if (Math.abs(enemy.x - weapon.x) <= weapon.range + bodyRange && Math.abs(enemy.y - weapon.y) < 46) {
                            this.enemies.damage(enemy, damage);
                            this.particles.elec(weapon.x, weapon.y - 10, enemy.x, enemy.y - (enemy.giant ? 54 : 8));
                            this.particles.gridPulse(weapon.x, weapon.y - 8);
                            this.particles.damage(enemy.x, enemy.y - (enemy.giant ? 94 : 24), '\u611f\u7535', '#8cecff');
                            this.impacts.gridRight = 1;
                            hitCount += 1;
                        }
                    });
                    weapon.timer = hitCount > 0 ? cooldown : 0.15;
                }
            }
        }

        render() {}
    }

    window.ShelterTD.DefenseSystem = DefenseSystem;
})();
