(function() {
    const GmCatalogSync = {
        loaded: false,

        async load() {
            if (this.loaded) {
                return true;
            }

            const baseUrl = window.httpClient?.getBaseUrl?.();
            if (!baseUrl || typeof fetch !== 'function') {
                return false;
            }

            try {
                const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/gm/catalog/public`, {
                    method: 'GET',
                    cache: 'no-store'
                });
                if (!response.ok) {
                    return false;
                }
                const catalog = await response.json();
                this.apply(catalog);
                this.loaded = true;
                return true;
            } catch (error) {
                console.warn('[GmCatalogSync] load failed:', error);
                return false;
            }
        },

        apply(catalog) {
            this.applyResources(catalog?.resources);
            this.applyItems(catalog?.items);
            this.ensureGachaTicketItems();
            this.applyEquipment(catalog?.equipment);
            this.applyEnemySkills(catalog?.enemySkills);
            this.applyEnemies(catalog?.enemies);
            this.applyGachaPools(catalog?.gachaPools);
            this.applyShelterBuildings(catalog?.shelterBuildings);
            this.applyDungeonChapters(catalog?.dungeonChapters);
            this.applyDungeons(catalog?.dungeons);
            this.applyShopItems(catalog?.shopItems);
            this.applyWelfareGifts(catalog?.welfareGifts);
        },

        refreshDungeonRuntime() {
            window.dungeonManager?.reloadFromConfig?.();
            window.game?.ui?.dungeonView?.refresh?.();
        },

        applyResources(resources) {
            if (!window.ResourceVisualConfig || !Array.isArray(resources)) {
                return;
            }

            window.GmCatalogResourceMeta = window.GmCatalogResourceMeta || {};
            resources.forEach(entry => {
                if (!entry?.id) {
                    return;
                }
                const current = window.ResourceVisualConfig.icons[entry.id] || {};
                window.ResourceVisualConfig.icons[entry.id] = {
                    ...current,
                    src: entry.iconSrc || entry.src || current.src || '',
                    fallback: entry.fallback || entry.icon || current.fallback || String(entry.id).slice(0, 1).toUpperCase()
                };
                window.GmCatalogResourceMeta[entry.id] = {
                    name: entry.name || entry.id,
                    icon: entry.icon || entry.fallback || current.fallback || String(entry.id).slice(0, 1).toUpperCase(),
                    iconSrc: entry.iconSrc || entry.src || current.src || '',
                    rarity: entry.rarity || 'common',
                    description: entry.description || ''
                };
            });

            this.patchShelterResourceInfo();
        },

        patchShelterResourceInfo() {
            if (!window.shelterManager || window.shelterManager.__gmCatalogPatched) {
                return;
            }

            const originalGetResourceInfo = window.shelterManager.getResourceInfo?.bind(window.shelterManager);
            const originalGetPrimaryResourceTypes = window.shelterManager.getPrimaryResourceTypes?.bind(window.shelterManager);
            window.shelterManager.getResourceInfo = function(type) {
                const resourceType = this.normalizeResourceType?.(type) || type;
                const baseInfo = originalGetResourceInfo ? originalGetResourceInfo(resourceType) : {};
                const override = window.GmCatalogResourceMeta?.[resourceType];
                if (!override) {
                    return baseInfo;
                }
                return {
                    ...baseInfo,
                    ...override,
                    iconSrc: override.iconSrc || baseInfo.iconSrc || ''
                };
            };
            window.shelterManager.getPrimaryResourceTypes = function() {
                const baseTypes = originalGetPrimaryResourceTypes ? originalGetPrimaryResourceTypes() : [];
                return [...new Set([...baseTypes, ...Object.keys(window.GmCatalogResourceMeta || {})])];
            };
            window.shelterManager.__gmCatalogPatched = true;
        },

        applyItems(items) {
            if (!window.ItemConfig || !Array.isArray(items)) {
                return;
            }

            items.forEach(entry => {
                if (!entry?.id) {
                    return;
                }
                if (this.isLegacyEquipmentItem(entry)) {
                    return;
                }
                const nextItem = { ...entry };
                delete nextItem.category;
                delete nextItem.source;
                delete nextItem.iconSrc;
                window.ItemConfig.items[entry.id] = {
                    ...(window.ItemConfig.items[entry.id] || {}),
                    ...nextItem
                };
                if (entry.iconSrc) {
                    window.ItemConfig.iconSources[entry.id] = entry.iconSrc;
                }
            });
        },

        getGachaTicketDefaults() {
            return {
                hero_summon: {
                    id: 'hero_summon',
                    name: '英雄招募券',
                    icon: '🎟️',
                    type: 'special',
                    rarity: 'epic',
                    description: '可在招募中心进行1次英雄招募',
                    effect: { type: 'gacha', poolId: 'hero_pool', count: 1 },
                    stackLimit: 9999,
                    iconSrc: 'assets/images/items/hero-summon.png'
                },
                hero_recruit_ten_ticket: {
                    id: 'hero_recruit_ten_ticket',
                    name: '英雄招募10连券',
                    icon: '🎟️',
                    type: 'special',
                    rarity: 'legendary',
                    description: '可在招募中心进行1次英雄10连招募',
                    effect: { type: 'gacha', poolId: 'hero_pool', count: 10 },
                    stackLimit: 9999,
                    iconSrc: 'assets/images/items/hero-summon.png'
                },
                weapon_forge_ticket: {
                    id: 'weapon_forge_ticket',
                    name: '武器打造券',
                    icon: '🎟️',
                    type: 'special',
                    rarity: 'epic',
                    description: '可在招募中心进行1次装备打造',
                    effect: { type: 'gacha', poolId: 'equipment_pool', count: 1 },
                    stackLimit: 9999,
                    iconSrc: 'assets/images/items/hero-summon.png'
                },
                weapon_forge_ten_ticket: {
                    id: 'weapon_forge_ten_ticket',
                    name: '武器打造10连券',
                    icon: '🎟️',
                    type: 'special',
                    rarity: 'legendary',
                    description: '可在招募中心进行1次装备10连打造',
                    effect: { type: 'gacha', poolId: 'equipment_pool', count: 10 },
                    stackLimit: 9999,
                    iconSrc: 'assets/images/items/hero-summon.png'
                },
                ad_skip_card: {
                    id: 'ad_skip_card',
                    name: '免广告卡',
                    icon: 'AD',
                    type: 'special',
                    rarity: 'epic',
                    description: '领取激励视频奖励时自动消耗1张，可免看一次广告并直接获得奖励。',
                    effect: { type: 'skip_reward_ad' },
                    stackLimit: 9999,
                    iconSrc: 'assets/images/items/ad-skip-card.png'
                }
            };
        },

        ensureGachaTicketItems() {
            if (!window.ItemConfig?.items) {
                return;
            }

            Object.entries(this.getGachaTicketDefaults()).forEach(([id, ticket]) => {
                const current = window.ItemConfig.items[id] || {};
                window.ItemConfig.items[id] = {
                    ...current,
                    ...ticket,
                    icon: current.icon || ticket.icon,
                    rarity: current.rarity || ticket.rarity,
                    type: ticket.type,
                    effect: { ...ticket.effect },
                    stackLimit: Math.max(Number(current.stackLimit) || 0, ticket.stackLimit)
                };
                window.ItemConfig.iconSources[id] = window.ItemConfig.iconSources[id] || ticket.iconSrc;
            });
        },

        applyEquipment(equipment) {
            if (!window.EquipmentConfig || !Array.isArray(equipment)) {
                return;
            }

            const byId = new Map((window.EquipmentConfig.templates || []).map(template => [template.id, template]));
            equipment.forEach(entry => {
                if (!entry?.id) {
                    return;
                }
                const nextTemplate = { ...entry };
                delete nextTemplate.category;
                delete nextTemplate.source;
                const current = byId.get(entry.id);
                if (current) {
                    Object.assign(current, nextTemplate);
                } else {
                    window.EquipmentConfig.templates.push(nextTemplate);
                    byId.set(entry.id, nextTemplate);
                }
                this.applyLegacyEquipmentItem(entry);
            });
        },

        applyGachaPools(pools) {
            if (!window.GachaConfig || !Array.isArray(pools)) {
                return;
            }

            window.GachaConfig.pools = window.GachaConfig.pools || {};
            pools.forEach(entry => {
                if (!entry?.id) {
                    return;
                }
                const nextPool = this.stripCatalogMeta(entry);
                const current = window.GachaConfig.pools[entry.id] || {};
                window.GachaConfig.pools[entry.id] = {
                    ...current,
                    ...nextPool,
                    entries: Array.isArray(nextPool.entries) ? nextPool.entries.map(item => ({ ...item })) : []
                };
            });
        },

        applyEnemies(enemies) {
            if (!window.DungeonConfig || !Array.isArray(enemies)) {
                return;
            }

            const nextEnemies = {};
            enemies.forEach(entry => {
                if (!entry?.id) {
                    return;
                }
                const nextEnemy = this.stripCatalogMeta(entry);
                delete nextEnemy.stats;
                delete nextEnemy.baseStats;
                delete nextEnemy.rank;
                nextEnemies[entry.id] = {
                    ...(window.DungeonConfig.enemyTemplates?.[entry.id] || {}),
                    ...nextEnemy
                };
            });

            window.DungeonConfig.enemyTemplates = {
                ...(window.DungeonConfig.enemyTemplates || {}),
                ...nextEnemies
            };
            if (window.UnitCatalogLoader?.data) {
                window.UnitCatalogLoader.data.enemies = {
                    ...(window.UnitCatalogLoader.data.enemies || {}),
                    ...nextEnemies
                };
            }
        },

        applyEnemySkills(enemySkills) {
            if (!window.DungeonConfig || !Array.isArray(enemySkills)) {
                return;
            }

            const nextSkills = {};
            enemySkills.forEach(entry => {
                if (!entry?.id) {
                    return;
                }
                nextSkills[entry.id] = this.stripCatalogMeta(entry);
            });

            window.DungeonConfig.enemySkillTemplates = {
                ...(window.DungeonConfig.enemySkillTemplates || {}),
                ...nextSkills
            };
            if (window.UnitCatalogLoader?.data) {
                window.UnitCatalogLoader.data.enemySkills = {
                    ...(window.UnitCatalogLoader.data.enemySkills || {}),
                    ...nextSkills
                };
            }
        },

        applyDungeons(dungeons) {
            if (!window.DungeonConfig || !Array.isArray(dungeons)) {
                return;
            }

            window.DungeonConfig.dungeons = dungeons
                .filter(entry => entry?.id)
                .map(entry => this.stripCatalogMeta(entry));
            this.refreshDungeonRuntime();
        },

        applyDungeonChapters(chapters) {
            if (!Array.isArray(chapters)) {
                return;
            }

            window.DungeonChapterConfig = chapters
                .filter(entry => entry?.id)
                .map(entry => this.stripCatalogMeta(entry));
            window.game?.ui?.dungeonView?.refresh?.();
        },

        applyShopItems(shopItems) {
            if (!window.ShopConfig || !Array.isArray(shopItems)) {
                return;
            }

            window.ShopConfig.gmShopItems = shopItems
                .filter(entry => entry?.id)
                .map(entry => this.stripCatalogMeta(entry));
        },

        applyWelfareGifts(welfareGifts) {
            if (!Array.isArray(welfareGifts)) {
                return;
            }

            window.CheckinConfig = window.CheckinConfig || {};
            window.CheckinConfig.welfareGifts = welfareGifts
                .filter(entry => entry?.id)
                .map(entry => this.stripCatalogMeta(entry));
            window.game?.ui?.checkinView?.refresh?.();
        },

        applyShelterBuildings(buildings) {
            if (!window.BuildingConfig || !Array.isArray(buildings)) {
                return;
            }

            const byId = new Map((window.BuildingConfig.buildings || []).map(entry => [entry.id, entry]));
            buildings.forEach(entry => {
                if (!entry?.id) {
                    return;
                }
                const nextBuilding = this.stripCatalogMeta(entry);
                nextBuilding.levels = Array.isArray(nextBuilding.levels)
                    ? nextBuilding.levels.map(level => ({ ...level }))
                    : [];
                const current = byId.get(entry.id);
                if (current) {
                    Object.keys(current).forEach(key => delete current[key]);
                    Object.assign(current, nextBuilding);
                } else {
                    window.BuildingConfig.buildings.push(nextBuilding);
                    byId.set(entry.id, nextBuilding);
                }
            });

            window.shelterManager?.getAllBuildings?.().forEach(building => {
                const config = window.BuildingConfig.getBuildingConfig?.(building.id);
                if (!config) {
                    return;
                }
                building.name = config.name || building.name;
                building.icon = config.icon || building.icon;
                building.description = config.description || building.description;
                building.maxLevel = config.maxLevel || building.maxLevel;
                building.updateLevelEffect?.();
            });
            window.game?.ui?.shelterView?.refresh?.();
        },

        stripCatalogMeta(entry) {
            const next = { ...entry };
            delete next.category;
            delete next.source;
            delete next.updatedAt;
            delete next.deleted;
            return next;
        },

        isLegacyEquipmentItem(entry) {
            return ['weapon', 'armor'].includes(String(entry?.type || entry?.legacyItemType || ''));
        },

        applyLegacyEquipmentItem(entry) {
            if (!window.ItemConfig || !entry?.id || !(entry.legacySource === 'item' || entry.legacyItemType)) {
                return;
            }

            const legacyItemType = entry.legacyItemType || (entry.slot === 'weapon' ? 'weapon' : 'armor');
            const current = window.ItemConfig.items[entry.id] || {};
            window.ItemConfig.items[entry.id] = {
                ...current,
                id: entry.id,
                name: entry.name || current.name || entry.id,
                icon: entry.icon || current.icon || '📦',
                type: legacyItemType,
                rarity: entry.rarity || current.rarity || 'common',
                description: entry.description || current.description || '',
                stats: entry.fixedStats || entry.stats || current.stats || {},
                stackLimit: 1
            };
            if (entry.iconSrc) {
                window.ItemConfig.iconSources[entry.id] = entry.iconSrc;
            }
        }
    };

    window.GmCatalogSync = GmCatalogSync;
})();
