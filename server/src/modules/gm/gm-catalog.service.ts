import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as vm from 'vm';

type CatalogType =
  | 'resources'
  | 'items'
  | 'equipment'
  | 'gachaPools'
  | 'shelterBuildings'
  | 'dungeonChapters'
  | 'dungeons'
  | 'enemySkills'
  | 'shopItems'
  | 'welfareGifts';

interface CatalogOverrides {
  resources: Record<string, any>;
  items: Record<string, any>;
  equipment: Record<string, any>;
  gachaPools: Record<string, any>;
  shelterBuildings: Record<string, any>;
  dungeonChapters: Record<string, any>;
  dungeons: Record<string, any>;
  enemySkills: Record<string, any>;
  shopItems: Record<string, any>;
  welfareGifts: Record<string, any>;
}

const RESOURCE_META: Record<string, any> = {
  gold: {
    name: '金币',
    icon: 'G',
    rarity: 'common',
    description: '通用货币，可用于招募、商城购买和建筑发展',
  },
  wood: {
    name: '木材',
    icon: 'W',
    rarity: 'common',
    description: '避难所建设的基础材料之一',
  },
  stone: {
    name: '石材',
    icon: 'S',
    rarity: 'common',
    description: '避难所建设的基础材料之一',
  },
  meat: {
    name: '肉类',
    icon: 'M',
    rarity: 'common',
    description: '重要食物资源，可维持生存',
  },
  iron_ore: {
    name: '铁矿石',
    icon: 'I',
    rarity: 'rare',
    description: '装备强化的重要材料',
  },
  diamond: {
    name: '钻石',
    icon: 'D',
    rarity: 'epic',
    description: '高价值稀有货币',
  },
};

const LEGACY_EQUIPMENT_SLOT_MAP: Record<string, string> = {
  weapon: 'weapon',
  armor: 'clothes',
};

@Injectable()
export class GmCatalogService {
  private readonly rootDir = path.resolve(__dirname, '../../../../');
  private readonly overridesPath = path.join(
    this.rootDir,
    'server',
    'data',
    'gm-catalog-overrides.json',
  );

  async getCatalog() {
    const [baseCatalog, overrides] = await Promise.all([
      this.loadBaseCatalog(),
      this.loadOverrides(),
    ]);

    return this.mergeCatalog(baseCatalog, overrides);
  }

  async getPublicCatalog() {
    const catalog = await this.getCatalog();
    return {
      success: true,
      updatedAt: new Date().toISOString(),
      resources: catalog.resources,
      items: catalog.items,
      equipment: catalog.equipment,
      gachaPools: catalog.gachaPools,
      shelterBuildings: catalog.shelterBuildings,
      dungeonChapters: catalog.dungeonChapters,
      dungeons: catalog.dungeons,
      enemySkills: catalog.enemySkills,
      shopItems: catalog.shopItems,
      welfareGifts: catalog.welfareGifts,
    };
  }

  async upsertEntry(type: CatalogType, id: string, data: Record<string, any>) {
    const cleanId = String(id || data?.id || '').trim();
    if (!cleanId) {
      throw new BadRequestException('Catalog id is required');
    }

    const targetType: CatalogType =
      type === 'items' && this.isLegacyEquipmentItem(data) ? 'equipment' : type;
    this.assertCatalogType(targetType);
    const catalog = await this.getCatalog();
    const current = this.findEntry(catalog, targetType, cleanId) || {};
    const mergedEntry = {
      ...current,
      ...data,
      id: cleanId,
      updatedAt: new Date().toISOString(),
    };
    const nextEntry = this.normalizeEntry(
      targetType,
      targetType === 'equipment' && this.isLegacyEquipmentItem(mergedEntry)
        ? this.toLegacyEquipmentEntry(mergedEntry)
        : mergedEntry,
    );

    const overrides = await this.loadOverrides();
    overrides[targetType][cleanId] = nextEntry;
    if (targetType !== type) {
      delete overrides[type][cleanId];
    }
    await this.saveOverrides(overrides);

    return {
      success: true,
      entry: {
        ...nextEntry,
        category: this.getCategory(targetType),
      },
    };
  }

  async upsertEntries(type: CatalogType, entries: any[]) {
    this.assertCatalogType(type);
    const rows = Array.isArray(entries) ? entries : [];
    if (rows.length === 0) {
      throw new BadRequestException('No catalog entries were provided');
    }

    const overrides = await this.loadOverrides();
    const saved: any[] = [];
    rows.forEach((entry) => {
      const id = String(entry?.id || '').trim();
      if (!id) {
        return;
      }
      const normalized = this.normalizeEntry(type, {
        ...entry,
        id,
        updatedAt: new Date().toISOString(),
      });
      overrides[type][id] = normalized;
      saved.push({
        ...normalized,
        category: this.getCategory(type),
      });
    });
    await this.saveOverrides(overrides);

    return {
      success: true,
      savedCount: saved.length,
      entries: saved,
    };
  }

  async deleteEntry(type: CatalogType, id: string) {
    this.assertCatalogType(type);
    const cleanId = String(id || '').trim();
    const overrides = await this.loadOverrides();
    if (this.isDeletableCatalogType(type)) {
      overrides[type][cleanId] = {
        id: cleanId,
        deleted: true,
        updatedAt: new Date().toISOString(),
      };
    } else {
      delete overrides[type][cleanId];
    }
    if (type === 'equipment' && !this.isDeletableCatalogType(type)) {
      delete overrides.items[cleanId];
    }
    await this.saveOverrides(overrides);
    return { success: true, id: cleanId };
  }

  private assertCatalogType(type: CatalogType) {
    if (
      ![
        'resources',
        'items',
        'equipment',
        'gachaPools',
        'shelterBuildings',
        'dungeonChapters',
        'dungeons',
        'enemySkills',
        'shopItems',
        'welfareGifts',
      ].includes(type)
    ) {
      throw new BadRequestException('Unsupported catalog type');
    }
  }

  private isDeletableCatalogType(type: CatalogType) {
    return ['dungeonChapters', 'dungeons', 'shopItems', 'welfareGifts'].includes(type);
  }

  private getCategory(type: CatalogType) {
    if (type === 'resources') {
      return 'resource';
    }
    if (type === 'equipment') {
      return 'equipment';
    }
    if (type === 'gachaPools') {
      return 'gachaPool';
    }
    if (type === 'shelterBuildings') {
      return 'shelterBuilding';
    }
    if (type === 'dungeonChapters') {
      return 'dungeonChapter';
    }
    if (type === 'dungeons') {
      return 'dungeon';
    }
    if (type === 'enemySkills') {
      return 'enemySkill';
    }
    if (type === 'shopItems') {
      return 'shopItem';
    }
    if (type === 'welfareGifts') {
      return 'welfareGift';
    }
    return 'item';
  }

  private findEntry(catalog: any, type: CatalogType, id: string) {
    return (catalog[type] || []).find((entry) => entry.id === id) || null;
  }

  private normalizeEntry(type: CatalogType, entry: Record<string, any>) {
    const normalized = { ...entry };
    delete normalized.category;

    if (type === 'resources') {
      normalized.iconSrc = normalized.iconSrc || normalized.src || '';
      normalized.src = normalized.iconSrc || normalized.src || '';
    }

    if (type === 'items') {
      normalized.stackLimit = Math.max(1, Number(normalized.stackLimit) || 1);
    }

    if (type === 'equipment') {
      if (this.isLegacyEquipmentItem(normalized)) {
        Object.assign(normalized, this.toLegacyEquipmentEntry(normalized));
      }
      normalized.rarities = Array.isArray(normalized.rarities)
        ? normalized.rarities
        : [normalized.rarity || 'common'].filter(Boolean);
      normalized.fixedStats = normalized.fixedStats || normalized.stats || {};
      normalized.statRules = normalized.statRules || {};
      delete normalized.type;
      delete normalized.stats;
      delete normalized.stackLimit;
      delete normalized.effect;
    }

    if (type === 'gachaPools') {
      normalized.entries = this.normalizeGachaEntries(normalized.entries);
      normalized.costs = this.normalizeCosts(normalized.costs);
      normalized.type = normalized.type || 'mixed';
    }

    if (type === 'shelterBuildings') {
      Object.assign(normalized, this.normalizeShelterBuildingEntry(normalized));
    }

    if (type === 'dungeonChapters') {
      Object.assign(normalized, this.normalizeDungeonChapterEntry(normalized));
    }

    if (type === 'dungeons') {
      Object.assign(normalized, this.normalizeDungeonEntry(normalized));
    }

    if (type === 'enemySkills') {
      Object.assign(normalized, this.normalizeEnemySkillEntry(normalized));
    }

    if (type === 'shopItems') {
      Object.assign(normalized, this.normalizeShopItemEntry(normalized));
    }

    if (type === 'welfareGifts') {
      Object.assign(normalized, this.normalizeWelfareGiftEntry(normalized));
    }

    return normalized;
  }

  private mergeCatalog(baseCatalog: any, overrides: CatalogOverrides) {
    const catalogOverrides = this.reclassifyLegacyEquipmentOverrides(baseCatalog, overrides);
    const dungeons = this.mergeEntries(baseCatalog.dungeons, catalogOverrides.dungeons, 'dungeon');
    const dungeonIds = new Set(dungeons.map((dungeon) => dungeon.id));
    const dungeonChapters = this.mergeEntries(
      baseCatalog.dungeonChapters,
      catalogOverrides.dungeonChapters,
      'dungeonChapter',
    ).map((chapter) => ({
      ...chapter,
      dungeonIds: (chapter.dungeonIds || []).filter((dungeonId: string) => dungeonIds.has(dungeonId)),
    }));

    return {
      success: true,
      resources: this.mergeEntries(baseCatalog.resources, catalogOverrides.resources, 'resource'),
      items: this.mergeEntries(baseCatalog.items, catalogOverrides.items, 'item'),
      equipment: this.mergeEntries(baseCatalog.equipment, catalogOverrides.equipment, 'equipment'),
      gachaPools: this.mergeEntries(baseCatalog.gachaPools, catalogOverrides.gachaPools, 'gachaPool'),
      shelterBuildings: this.mergeEntries(
        baseCatalog.shelterBuildings,
        catalogOverrides.shelterBuildings,
        'shelterBuilding',
      ),
      dungeonChapters,
      dungeons,
      enemySkills: this.mergeEntries(baseCatalog.enemySkills, catalogOverrides.enemySkills, 'enemySkill'),
      shopItems: this.mergeEntries(baseCatalog.shopItems, catalogOverrides.shopItems, 'shopItem'),
      welfareGifts: this.mergeEntries(baseCatalog.welfareGifts, catalogOverrides.welfareGifts, 'welfareGift'),
      enemies: baseCatalog.enemies,
    };
  }

  private reclassifyLegacyEquipmentOverrides(
    baseCatalog: any,
    overrides: CatalogOverrides,
  ): CatalogOverrides {
    const legacyEquipmentIds = new Set(
      (baseCatalog.equipment || [])
        .filter((entry: any) => entry?.legacySource === 'item')
        .map((entry: any) => entry.id),
    );
    const baseEquipmentById = new Map<string, Record<string, any>>(
      (baseCatalog.equipment || []).map((entry: any) => [entry.id, entry]),
    );
    const items = { ...(overrides.items || {}) };
    const equipment = { ...(overrides.equipment || {}) };

    Object.entries(items).forEach(([id, override]) => {
      if (!legacyEquipmentIds.has(id) && !this.isLegacyEquipmentItem(override)) {
        return;
      }

      const current = baseEquipmentById.get(id) || {};
      equipment[id] = this.toLegacyEquipmentEntry({
        ...current,
        ...override,
        id,
      });
      delete items[id];
    });

    return {
      resources: overrides.resources || {},
      items,
      equipment,
      gachaPools: overrides.gachaPools || {},
      shelterBuildings: overrides.shelterBuildings || {},
      dungeonChapters: overrides.dungeonChapters || {},
      dungeons: overrides.dungeons || {},
      enemySkills: overrides.enemySkills || {},
      shopItems: overrides.shopItems || {},
      welfareGifts: overrides.welfareGifts || {},
    };
  }

  private mergeEntries(baseEntries: any[], overrides: Record<string, any>, category: string) {
    const map = new Map<string, any>();

    baseEntries.forEach((entry) => {
      map.set(entry.id, { ...entry, category });
    });

    Object.entries(overrides || {}).forEach(([id, override]) => {
      if (override?.deleted) {
        map.delete(id);
        return;
      }
      const current = map.get(id) || { id };
      map.set(id, { ...current, ...override, id, category, source: 'gm' });
    });

    const values = [...map.values()];
    if (category === 'dungeonChapter') {
      return values.sort(
        (left, right) =>
          Number(left.index || left.chapterNumber || 1) - Number(right.index || right.chapterNumber || 1) ||
          String(left.name || left.id).localeCompare(String(right.name || right.id), 'zh-CN'),
      );
    }
    if (category === 'dungeon') {
      return values.sort(
        (left, right) =>
          Number(left.chapterNumber || 1) - Number(right.chapterNumber || 1) ||
          Number(left.stageNumber || 1) - Number(right.stageNumber || 1) ||
          String(left.name || left.id).localeCompare(String(right.name || right.id), 'zh-CN'),
      );
    }
    if (category === 'shopItem') {
      return values.sort(
        (left, right) =>
          Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
          String(left.id || '').localeCompare(String(right.id || ''), 'zh-CN'),
      );
    }
    if (category === 'welfareGift') {
      return values.sort(
        (left, right) =>
          Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
          String(left.name || left.id || '').localeCompare(String(right.name || right.id || ''), 'zh-CN'),
      );
    }
    return values.sort((left, right) =>
      String(left.name || left.id).localeCompare(String(right.name || right.id), 'zh-CN'),
    );
  }

  private async loadBaseCatalog() {
    const itemWindow = this.loadBrowserConfig('js/config/ItemConfig.js');
    const resourceWindow = this.loadBrowserConfig('js/config/ResourceVisualConfig.js');
    const equipmentWindow = this.loadBrowserConfig('js/config/EquipmentConfig.js');
    const heroWindow = this.loadBrowserConfig('js/config/HeroConfig.js');
    const gachaWindow = this.loadBrowserConfig('js/config/GachaConfig.js');
    const dungeonWindow = this.loadBrowserConfig('js/config/DungeonConfig.js');
    const buildingWindow = this.loadBrowserConfig('js/config/BuildingConfig.js');
    const sceneMediaWindow = this.loadBrowserConfig('js/config/SceneMediaConfigPatch.js');
    const shopWindow = this.loadBrowserConfig('js/config/ShopConfig.js', {
      ResourceVisualConfig: resourceWindow.ResourceVisualConfig || {},
      ItemConfig: itemWindow.ItemConfig || {},
      HeroConfig: heroWindow.HeroConfig || {},
    });

    const itemConfig = itemWindow.ItemConfig || {};
    const resourceConfig = resourceWindow.ResourceVisualConfig || {};
    const equipmentConfig = equipmentWindow.EquipmentConfig || {};
    const heroConfig = heroWindow.HeroConfig || {};
    const gachaConfig = gachaWindow.GachaConfig || {};
    const dungeonConfig = dungeonWindow.DungeonConfig || {};
    const buildingConfig = buildingWindow.BuildingConfig || {};
    const chapterConfig = Array.isArray(sceneMediaWindow.DungeonChapterConfig)
      ? sceneMediaWindow.DungeonChapterConfig
      : [];
    const shopConfig = shopWindow.ShopConfig || {};

    const resources = Object.entries(resourceConfig.icons || {}).map(([id, icon]: [string, any]) => ({
      id,
      category: 'resource',
      type: 'resource',
      name: RESOURCE_META[id]?.name || id,
      icon: RESOURCE_META[id]?.icon || icon?.fallback || id.slice(0, 1).toUpperCase(),
      iconSrc: icon?.src || '',
      fallback: icon?.fallback || '',
      rarity: RESOURCE_META[id]?.rarity || 'common',
      description: RESOURCE_META[id]?.description || '基础资源',
    }));

    const itemEntries = Object.entries(itemConfig.items || {}).map(([id, item]: [string, any]) => ({
      ...item,
      id,
      category: 'item',
      iconSrc: item?.iconSrc || itemConfig.iconSources?.[id] || '',
    }));
    const items = itemEntries.filter((item) => !this.isLegacyEquipmentItem(item));
    if (!items.some((item) => item.id === 'ad_skip_card')) {
      items.push({
        id: 'ad_skip_card',
        category: 'item',
        name: '\u514d\u5e7f\u544a\u5361',
        icon: 'AD',
        type: 'special',
        rarity: 'epic',
        description:
          '\u9886\u53d6\u6fc0\u52b1\u89c6\u9891\u5956\u52b1\u65f6\u81ea\u52a8\u6d88\u80171\u5f20\uff0c\u53ef\u514d\u770b\u4e00\u6b21\u5e7f\u544a\u5e76\u76f4\u63a5\u83b7\u5f97\u5956\u52b1\u3002',
        effect: { type: 'skip_reward_ad' },
        stackLimit: 9999,
        iconSrc: 'assets/images/items/ad-skip-card.png',
      });
    }
    const legacyEquipment = itemEntries
      .filter((item) => this.isLegacyEquipmentItem(item))
      .map((item) => this.toLegacyEquipmentEntry(item));
    const heroFragments = this.getHeroList(heroConfig).map((hero: any) =>
      this.toHeroFragmentItemEntry(hero),
    );

    const equipment = (Array.isArray(equipmentConfig.templates) ? equipmentConfig.templates : []).map(
      (template: any) => ({
        ...template,
        category: 'equipment',
        iconSrc:
          template.iconSrc ||
          `assets/images/equipment/${String(template.id || '').replace(/_/g, '-')}.png`,
      }),
    );

    const gachaPools = Object.values(gachaConfig.pools || {}).map((pool: any) =>
      this.normalizeEntry('gachaPools', {
        ...pool,
        id: pool?.id,
        category: 'gachaPool',
      }),
    );

    const shelterBuildings = (Array.isArray(buildingConfig.buildings) ? buildingConfig.buildings : []).map(
      (building: any) =>
        this.normalizeEntry('shelterBuildings', {
          ...building,
          category: 'shelterBuilding',
        }),
    );

    const dungeonChapters = chapterConfig.map((chapter: any, index: number) =>
      this.normalizeEntry('dungeonChapters', {
        ...chapter,
        index: chapter?.index ?? index + 1,
        category: 'dungeonChapter',
      }),
    );
    const chapterByDungeonId = this.getChapterDungeonMap(dungeonChapters);
    const dungeons = (Array.isArray(dungeonConfig.dungeons) ? dungeonConfig.dungeons : []).map(
      (dungeon: any, index: number) => {
        const relation = chapterByDungeonId.get(String(dungeon?.id || ''));
        return this.normalizeEntry('dungeons', {
          ...dungeon,
          chapterId: relation?.chapterId || dungeon?.chapterId || '',
          chapterNumber: relation?.chapterNumber ?? dungeon?.chapterNumber ?? dungeon?.chapter ?? 1,
          stageNumber: relation?.stageNumber ?? dungeon?.stageNumber ?? dungeon?.stage ?? index + 1,
          category: 'dungeon',
        });
      },
    );

    const enemies = this.getEnemyList(dungeonConfig);
    const enemySkills = this.getEnemySkillList(dungeonConfig);
    const shopItems =
      typeof shopConfig.getShopItems === 'function'
        ? shopConfig.getShopItems.call(shopConfig).map((item: any, index: number) =>
            this.normalizeEntry('shopItems', {
              ...item,
              sortOrder: item?.sortOrder ?? index + 1,
              category: 'shopItem',
            }),
          )
        : [];
    const welfareGifts = this.getDefaultWelfareGifts().map((gift: any, index: number) =>
      this.normalizeEntry('welfareGifts', {
        ...gift,
        sortOrder: gift?.sortOrder ?? index + 1,
        category: 'welfareGift',
      }),
    );

    return {
      resources,
      items: [...items, ...heroFragments],
      equipment: [...equipment, ...legacyEquipment],
      gachaPools,
      shelterBuildings,
      dungeonChapters,
      dungeons,
      enemySkills,
      shopItems,
      welfareGifts,
      enemies,
    };
  }

  private isLegacyEquipmentItem(entry: Record<string, any> | null | undefined) {
    const type = String(entry?.type || entry?.legacyItemType || '').trim();
    return Boolean(LEGACY_EQUIPMENT_SLOT_MAP[type]);
  }

  private toLegacyEquipmentEntry(entry: Record<string, any>) {
    const legacyItemType = String(entry?.type || entry?.legacyItemType || '').trim();
    const rarity =
      entry?.rarity || (Array.isArray(entry?.rarities) ? entry.rarities[0] : null) || 'common';
    const fixedStats = entry?.fixedStats || entry?.stats || {};
    const {
      type: _type,
      stackLimit: _stackLimit,
      effect: _effect,
      stats: _stats,
      ...rest
    } = entry || {};

    return {
      ...rest,
      id: String(entry?.id || ''),
      category: 'equipment',
      slot: entry?.slot || LEGACY_EQUIPMENT_SLOT_MAP[legacyItemType] || 'weapon',
      rarity,
      rarities: Array.isArray(entry?.rarities) && entry.rarities.length > 0 ? entry.rarities : [rarity],
      fixedStats,
      statRules: entry?.statRules || {},
      iconSrc: entry?.iconSrc || '',
      legacySource: 'item',
      legacyItemType,
    };
  }

  private getHeroList(heroConfig: any) {
    if (typeof heroConfig.getAllHeroes === 'function') {
      return heroConfig.getAllHeroes.call(heroConfig);
    }
    return Array.isArray(heroConfig.heroes) ? heroConfig.heroes : [];
  }

  private toHeroFragmentItemEntry(hero: Record<string, any>) {
    const heroId = String(hero?.id || '').trim();
    return {
      id: `${heroId}_fragment`,
      category: 'item',
      type: 'fragment',
      rarity: hero?.rarity || 'common',
      name: `${hero?.name || heroId}碎片`,
      icon: hero?.icon || '◇',
      iconSrc: hero?.portrait || '',
      description: `用于${hero?.name || heroId}升星或后续合成英雄`,
      stackLimit: 9999,
      fragmentHeroId: heroId,
      fragmentSource: 'hero',
    };
  }

  private normalizeCosts(costs: any) {
    if (!costs || typeof costs !== 'object') {
      return {};
    }
    return Object.fromEntries(
      Object.entries(costs).map(([resourceId, config]: [string, any]) => [
        resourceId,
        {
          single: Math.max(0, Number(config?.single) || 0),
          ten: Math.max(0, Number(config?.ten) || 0),
        },
      ]),
    );
  }

  private getDefaultWelfareGifts() {
    return [
      {
        id: 'gift_gold',
        kind: 'gift',
        name: '\u8865\u7ed9\u91d1\u5e01\u7bb1',
        description: '\u9886\u53d6\u4e00\u6279\u57fa\u7840\u91d1\u5e01\u8865\u7ed9\u3002',
        sortOrder: 1,
        rewards: [{ type: 'resource', id: 'gold', count: 5000 }],
        adLimits: { normal: 3, welfare: 4, supreme: 5 },
      },
      {
        id: 'gift_diamond',
        kind: 'gift',
        name: '\u94bb\u77f3\u5e94\u6025\u5305',
        description: '\u8865\u5145\u5c11\u91cf\u7a00\u6709\u8d27\u5e01\u3002',
        sortOrder: 2,
        rewards: [{ type: 'resource', id: 'diamond', count: 50 }],
        adLimits: { normal: 3, welfare: 4, supreme: 5 },
      },
      {
        id: 'gift_energy',
        kind: 'gift',
        name: '\u4f5c\u6218\u4f53\u529b\u5305',
        description: '\u8865\u5145\u4f53\u529b\u836f\u6c34\u4e0e\u7ecf\u9a8c\u836f\u6c34\u3002',
        sortOrder: 3,
        rewards: [
          { type: 'item', id: 'energy_potion', count: 1 },
          { type: 'item', id: 'exp_potion', count: 20 },
        ],
        adLimits: { normal: 3, welfare: 4, supreme: 5 },
      },
      {
        id: 'welfare_month_card',
        kind: 'monthCard',
        name: '\u798f\u5229\u6708\u5361',
        title: '\u798f\u5229\u6708\u5361',
        subtitle: '\u6bcf\u65e5\u57fa\u7840\u8d44\u6e90\u8865\u7ed9',
        badge: '\u6708\u5361',
        description: '\u901a\u8fc7\u89c2\u770b\u6fc0\u52b1\u89c6\u9891\u6fc0\u6d3b\uff0c\u6fc0\u6d3b\u540e\u6bcf\u65e5\u53ef\u9886\u53d6\u4e00\u7ec4\u989d\u5916\u8d44\u6e90\u3002',
        sortOrder: 101,
        requiredViews: 30,
        activationViews: 30,
        durationDays: 30,
        dailyRewards: [
          { type: 'resource', id: 'gold', count: 3000 },
          { type: 'resource', id: 'meat', count: 20 },
        ],
      },
      {
        id: 'supreme_month_card',
        kind: 'monthCard',
        name: '\u81f3\u5c0a\u6708\u5361',
        title: '\u81f3\u5c0a\u6708\u5361',
        subtitle: '\u66f4\u9ad8\u9636\u7684\u65e5\u5e38\u798f\u5229',
        badge: '\u81f3\u5c0a',
        description: '\u6fc0\u6d3b\u95e8\u69db\u66f4\u9ad8\uff0c\u4f46\u6bcf\u65e5\u8865\u7ed9\u66f4\u4e30\u539a\uff0c\u540c\u65f6\u63d0\u5347\u798f\u5229\u793c\u5305\u89c2\u770b\u4e0a\u9650\u3002',
        sortOrder: 102,
        requiredViews: 55,
        activationViews: 55,
        durationDays: 30,
        dailyRewards: [
          { type: 'resource', id: 'diamond', count: 30 },
          { type: 'resource', id: 'gold', count: 6000 },
          { type: 'item', id: 'energy_potion', count: 1 },
        ],
      },
    ];
  }

  private normalizeGachaEntries(entries: any) {
    return (Array.isArray(entries) ? entries : [])
      .map((entry, index) => {
        const type = String(entry?.type || 'item').trim();
        const id = String(entry?.id || `${type}_${index + 1}`).trim();
        const min = Math.max(0, Number(entry?.min ?? entry?.count ?? 1) || 0);
        const max = Math.max(min, Number(entry?.max ?? entry?.count ?? min) || min);
        const weight = Math.max(0, Number(entry?.weight ?? entry?.probability) || 0);
        const normalized: Record<string, any> = {
          ...entry,
          id,
          type,
          min,
          max,
          weight,
          rateText: entry?.rateText || (weight ? `${weight}%` : ''),
        };
        if (type === 'resource') {
          normalized.resourceId = String(entry?.resourceId || entry?.targetId || entry?.id || '').trim();
        } else if (type === 'item') {
          normalized.itemId = String(entry?.itemId || entry?.targetId || entry?.id || '').trim();
        } else if (type === 'fragment' || type === 'hero') {
          normalized.heroRarity = String(entry?.heroRarity || entry?.targetId || entry?.rarity || 'common').trim();
        } else if (type === 'equipment') {
          normalized.rarity = String(entry?.rarity || entry?.targetId || 'common').trim();
        }
        return normalized;
      })
      .filter((entry) => entry.id && entry.weight > 0);
  }

  private normalizeShelterBuildingEntry(entry: Record<string, any>) {
    const maxLevel = Math.max(1, Number(entry?.maxLevel) || 1);
    const levels = (Array.isArray(entry?.levels) ? entry.levels : [])
      .map((levelEntry: any, index: number) => this.normalizeShelterBuildingLevel(levelEntry, index + 1))
      .filter((levelEntry: any) => levelEntry.level >= 1)
      .sort((left: any, right: any) => left.level - right.level);

    return {
      ...entry,
      id: String(entry?.id || '').trim(),
      name: String(entry?.name || entry?.id || '').trim(),
      icon: String(entry?.icon || '').trim(),
      description: String(entry?.description || '').trim(),
      maxLevel: Math.max(maxLevel, levels.length || 1),
      levels,
    };
  }

  private normalizeWelfareGiftEntry(entry: Record<string, any>) {
    const kind =
      String(entry?.kind || '').trim() === 'monthCard' ||
      String(entry?.id || '').trim().includes('month_card')
        ? 'monthCard'
        : 'gift';
    return {
      ...entry,
      kind,
      id: String(entry?.id || '').trim(),
      name: String(entry?.name || entry?.title || entry?.id || '').trim(),
      title: String(entry?.name || entry?.title || entry?.id || '').trim(),
      description: String(entry?.description || '').trim(),
      subtitle: String(entry?.subtitle || '').trim(),
      badge: String(entry?.badge || '').trim(),
      sortOrder: Math.max(0, Number(entry?.sortOrder) || 0),
      requiredViews: Math.max(1, Number(entry?.requiredViews ?? entry?.activationViews ?? 1) || 1),
      activationViews: Math.max(1, Number(entry?.activationViews ?? entry?.requiredViews ?? 1) || 1),
      durationDays: Math.max(1, Number(entry?.durationDays ?? 30) || 30),
      adLimits: {
        normal: Math.max(0, Number(entry?.adLimits?.normal ?? 3) || 0),
        welfare: Math.max(0, Number(entry?.adLimits?.welfare ?? 4) || 0),
        supreme: Math.max(0, Number(entry?.adLimits?.supreme ?? 5) || 0),
      },
      rewards: (Array.isArray(entry?.rewards) ? entry.rewards : [])
        .map((reward: any) => this.normalizeWelfareRewardEntry(reward))
        .filter((reward: any) => reward && reward.id),
      dailyRewards: (Array.isArray(entry?.dailyRewards) ? entry.dailyRewards : [])
        .map((reward: any) => this.normalizeWelfareRewardEntry(reward))
        .filter((reward: any) => reward && reward.id),
    };
  }

  private normalizeWelfareRewardEntry(reward: Record<string, any>) {
    const type = String(reward?.type || 'item').trim();
    const id = String(reward?.id || '').trim();
    if (!id) {
      return null;
    }
    const count = Math.max(1, Number(reward?.count ?? reward?.amount ?? 1) || 1);
    return {
      type,
      id,
      count,
    };
  }

  private normalizeShelterBuildingLevel(levelEntry: any, fallbackLevel: number) {
    const level = Math.max(1, Number(levelEntry?.level) || fallbackLevel);
    const normalized: Record<string, any> = {
      level,
      upgradeCost: this.normalizeSimpleCostMap(levelEntry?.upgradeCost),
    };

    if (levelEntry?.energyBonus !== undefined) {
      normalized.energyBonus = Math.max(0, Number(levelEntry.energyBonus) || 0);
    }
    if (levelEntry?.statBonus !== undefined) {
      normalized.statBonus = Math.max(0, Number(levelEntry.statBonus) || 0);
    }
    if (Array.isArray(levelEntry?.outputs)) {
      normalized.outputs = levelEntry.outputs
        .map((output: any) => ({
          type: String(output?.type || 'resource').trim() === 'item' ? 'item' : 'resource',
          id: String(output?.id || '').trim(),
          amountPerHour: Math.max(0, Number(output?.amountPerHour) || 0),
        }))
        .filter((output: any) => output.id);
    }

    return normalized;
  }

  private normalizeSimpleCostMap(costs: any) {
    if (!costs || typeof costs !== 'object' || Array.isArray(costs)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(costs)
        .map(([id, amount]) => [String(id || '').trim(), Math.max(0, Number(amount) || 0)] as [string, number])
        .filter(([id, amount]) => Boolean(id) && amount > 0),
    );
  }

  private normalizeDungeonEntry(entry: Record<string, any>) {
    const level = Math.max(1, Number(entry?.recommendedLevel ?? entry?.level) || 1);
    const rewards = entry?.rewards || {};
    return {
      ...entry,
      id: String(entry?.id || '').trim(),
      name: String(entry?.name || entry?.id || '').trim(),
      level,
      recommendedLevel: level,
      energyCost: Math.max(0, Number(entry?.energyCost) || 0),
      environmentEffect: this.normalizeDungeonEnvironmentEffect(
        entry?.environmentEffect ?? entry?.environmentEffectType ?? entry?.battleEnvironmentEffect ?? entry?.battlefield?.environmentEffect,
      ),
      chapterNumber: Math.max(1, Number(entry?.chapterNumber ?? entry?.chapter ?? 1) || 1),
      stageNumber: Math.max(1, Number(entry?.stageNumber ?? entry?.stage ?? 1) || 1),
      chapterDescription: String(entry?.chapterDescription || '').trim(),
      chapterBackground: String(entry?.chapterBackground || entry?.background || '').trim(),
      rewards: {
        ...rewards,
        gold: this.normalizeRange(rewards.gold),
        exp: this.normalizeRange(rewards.exp),
        chapter: this.normalizeRewardList(rewards.chapter),
        items: this.normalizeRewardList(rewards.items),
      },
      battlefield: this.normalizeBattlefield(entry?.battlefield),
      initialEnemies: this.normalizeDungeonEnemies(entry?.initialEnemies || entry?.enemies),
      bossWaves: this.normalizeBossWaves(entry?.bossWaves, entry?.id),
    };
  }

  private normalizeDungeonEnvironmentEffect(effect: any) {
    const rawType =
      effect && typeof effect === 'object'
        ? effect.type || effect.id || effect.effect || 'none'
        : effect;
    const type = String(rawType || 'none').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const aliases: Record<string, string> = {
      poison: 'poison_fog',
      toxic: 'poison_fog',
      toxic_fog: 'poison_fog',
      dust: 'dust_smoke',
      sand: 'dust_smoke',
      storm: 'storm_night',
      stormnight: 'storm_night',
      heavy_rain: 'storm_night',
      lightning_rain: 'storm_night',
    };
    const normalized = aliases[type] || type;
    return ['smoke', 'rain', 'snow', 'poison_fog', 'dust_smoke', 'storm_night'].includes(normalized) ? normalized : 'none';
  }

  private normalizeDungeonChapterEntry(entry: Record<string, any>) {
    const index = Math.max(1, Number(entry?.index ?? entry?.chapterNumber ?? 1) || 1);
    return {
      ...entry,
      id: String(entry?.id || `chapter_${String(index).padStart(2, '0')}`).trim(),
      index,
      chapterNumber: index,
      name: String(entry?.name || `第 ${index} 章`).trim(),
      icon: String(entry?.icon || '').trim(),
      recommendedLevel: Math.max(1, Number(entry?.recommendedLevel ?? entry?.level ?? 1) || 1),
      dungeonIds: (Array.isArray(entry?.dungeonIds) ? entry.dungeonIds : [])
        .map((dungeonId: any) => String(dungeonId || '').trim())
        .filter(Boolean),
      background: String(entry?.background || entry?.chapterBackground || '').trim(),
      description: String(entry?.description || entry?.chapterDescription || '').trim(),
    };
  }

  private normalizeEnemySkillEntry(entry: Record<string, any>) {
    const {
      category: _category,
      source: _source,
      updatedAt: _updatedAt,
      deleted: _deleted,
      ...rest
    } = entry || {};

    return {
      ...rest,
      id: String(entry?.id || '').trim(),
      name: String(entry?.name || entry?.id || '').trim(),
      icon: String(entry?.icon || '').trim(),
      rarity: String(entry?.rarity || 'common').trim(),
      description: String(entry?.description || '').trim(),
      effectType: String(entry?.effectType || 'damage').trim(),
      multiplier: Number(entry?.multiplier ?? 1) || 1,
      cooldownTurns: Math.max(0, Number(entry?.cooldownTurns ?? entry?.cooldown ?? 0) || 0),
      range: Math.max(0, Number(entry?.range ?? 1) || 0),
      targetType: String(entry?.targetType || 'enemy').trim(),
      targetCount: Math.max(1, Number(entry?.targetCount ?? 1) || 1),
    };
  }

  private getChapterDungeonMap(chapters: any[]) {
    const map = new Map<string, any>();
    (Array.isArray(chapters) ? chapters : []).forEach((chapter) => {
      (chapter.dungeonIds || []).forEach((dungeonId: string, index: number) => {
        map.set(dungeonId, {
          chapterId: chapter.id,
          chapterNumber: Number(chapter.index || chapter.chapterNumber || 1),
          stageNumber: index + 1,
        });
      });
    });
    return map;
  }

  private normalizeShopItemEntry(entry: Record<string, any>) {
    const type = String(entry?.type || 'consumable').trim();
    return {
      ...entry,
      id: String(entry?.id || '').trim(),
      name: String(entry?.name || entry?.id || '').trim(),
      icon: String(entry?.icon || '').trim(),
      iconSrc: String(entry?.iconSrc || '').trim(),
      type,
      rarity: String(entry?.rarity || 'common').trim(),
      price: Math.max(0, Number(entry?.price) || 0),
      currency: String(entry?.currency || 'gold').trim(),
      maxBuy: Math.max(0, Number(entry?.maxBuy) || 0),
      giveItem: String(entry?.giveItem || '').trim(),
      giveCount: Math.max(1, Number(entry?.giveCount) || 1),
      description: String(entry?.description || '').trim(),
      sortOrder: Number(entry?.sortOrder) || 0,
    };
  }

  private normalizeRange(range: any) {
    const min = Math.max(0, Number(range?.min ?? range?.count ?? 0) || 0);
    const max = Math.max(min, Number(range?.max ?? range?.count ?? min) || min);
    return { min, max };
  }

  private normalizeRewardList(rewards: any) {
    return (Array.isArray(rewards) ? rewards : [])
      .map((entry) => {
        const min = Math.max(1, Number(entry?.min ?? entry?.count ?? 1) || 1);
        const max = Math.max(min, Number(entry?.max ?? entry?.count ?? min) || min);
        return {
          id: String(entry?.id || '').trim(),
          min,
          max,
          chance: Math.max(0, Math.min(1, Number(entry?.chance ?? entry?.probability ?? 1) || 0)),
        };
      })
      .filter((entry) => entry.id);
  }

  private normalizeBattlefield(battlefield: any) {
    const cols = Math.max(1, Number(battlefield?.cols ?? battlefield?.width ?? 7) || 7);
    const rows = Math.max(1, Number(battlefield?.rows ?? battlefield?.height ?? 10) || 10);
    return {
      ...(battlefield || {}),
      cols,
      rows,
      heroSpawn: {
        ...(battlefield?.heroSpawn || {}),
        positions: this.normalizeCoordinateList(battlefield?.heroSpawn?.positions),
      },
      enemySpawn: {
        ...(battlefield?.enemySpawn || {}),
        positions: this.normalizeCoordinateList(battlefield?.enemySpawn?.positions),
      },
      obstacles: this.normalizeCoordinateList(battlefield?.obstacles),
    };
  }

  private normalizeDungeonEnemies(enemies: any) {
    return (Array.isArray(enemies) ? enemies : [])
      .map((entry) => {
        const statsSource = { ...(entry?.stats || entry?.baseStats || {}) };
        ['attackRange', 'crit', 'antiCrit', 'defensePen', 'accuracy', 'dodge'].forEach((field) => {
          if (entry?.[field] !== undefined) {
            statsSource[field] = entry[field];
          }
        });
        const stats = this.normalizeDungeonEnemyStats(statsSource);
        const overrideStats = this.normalizeDungeonEnemyStats(entry?.overrideStats);
        const normalized: Record<string, any> = {
          id: String(entry?.id || '').trim(),
          rank: String(entry?.rank || 'normal').trim(),
          count: Math.max(1, Number(entry?.count) || 1),
          positions: this.normalizeCoordinateList(entry?.positions || entry?.spawnPositions),
        };
        const skillIds = this.normalizeSkillIdList(entry?.skillIds);
        const skillRefs = this.normalizeSkillRefs(entry?.skillRefs);
        if (entry?.multiplier !== undefined) {
          normalized.multiplier = Math.max(0.1, Number(entry.multiplier) || 1);
        }
        if (skillIds.length) {
          normalized.skillIds = skillIds;
        }
        if (skillRefs.length) {
          normalized.skillRefs = skillRefs;
        }
        if (Array.isArray(entry?.skills) && entry.skills.length) {
          normalized.skills = entry.skills.filter(Boolean);
        }
        if (entry?.skill && typeof entry.skill === 'object') {
          normalized.skill = entry.skill;
        }
        if (Object.keys(stats).length) {
          normalized.stats = stats;
        }
        if (Object.keys(overrideStats).length) {
          normalized.overrideStats = overrideStats;
        }
        return normalized;
      })
      .filter((entry) => entry.id);
  }

  private normalizeDungeonEnemyStats(stats: any) {
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(stats)
        .map(([key, value]) => [key, Number(value)])
        .filter(([, value]) => Number.isFinite(value)),
    );
  }

  private normalizeSkillIdList(skillIds: any) {
    return (Array.isArray(skillIds) ? skillIds : [])
      .map((skillId) => String(skillId || '').trim())
      .filter(Boolean);
  }

  private normalizeSkillRefs(skillRefs: any) {
    return (Array.isArray(skillRefs) ? skillRefs : [])
      .map((ref) => {
        if (typeof ref === 'string') {
          const skillId = String(ref).trim();
          return skillId ? { skillId } : null;
        }
        if (!ref || typeof ref !== 'object') {
          return null;
        }
        const skillId = String(ref.skillId || ref.id || ref.refId || '').trim();
        if (!skillId) {
          return null;
        }
        const { id: _id, refId: _refId, ...rest } = ref;
        return {
          ...rest,
          skillId,
        };
      })
      .filter(Boolean);
  }

  private normalizeBossWaves(waves: any, dungeonId: any) {
    return (Array.isArray(waves) ? waves : []).map((wave, index) => ({
      id: String(wave?.id || `${dungeonId || 'dungeon'}_boss_wave_${index + 1}`),
      spawnRound: Math.max(1, Number(wave?.spawnRound) || 12),
      spawnOnClearBeforeRound: wave?.spawnOnClearBeforeRound !== false,
      bosses: this.normalizeDungeonEnemies(wave?.bosses),
    }));
  }

  private normalizeCoordinateList(list: any) {
    return (Array.isArray(list) ? list : [])
      .map((entry) => {
        if (Array.isArray(entry)) {
          return [Math.max(1, Number(entry[0]) || 1), Math.max(1, Number(entry[1]) || 1)];
        }
        if (entry && typeof entry === 'object') {
          return [
            Math.max(1, Number(entry.row ?? entry.y ?? 1) || 1),
            Math.max(1, Number(entry.col ?? entry.x ?? 1) || 1),
          ];
        }
        return null;
      })
      .filter(Boolean);
  }

  private getEnemyList(dungeonConfig: any) {
    if (typeof dungeonConfig.getAllEnemyConfigs === 'function') {
      return dungeonConfig
        .getAllEnemyConfigs.call(dungeonConfig)
        .map((enemy: any) => ({ ...enemy, category: 'enemy' }));
    }
    return Object.entries(dungeonConfig.enemies || {}).map(([id, enemy]: [string, any]) => ({
      ...enemy,
      id,
      category: 'enemy',
    }));
  }

  private getEnemySkillList(dungeonConfig: any) {
    if (typeof dungeonConfig.getAllEnemySkillConfigs === 'function') {
      return dungeonConfig
        .getAllEnemySkillConfigs.call(dungeonConfig)
        .map((skill: any) => ({ ...skill, category: 'enemySkill' }));
    }
    return Object.entries(dungeonConfig.enemySkillTemplates || {}).map(
      ([id, skill]: [string, any]) => ({
        ...skill,
        id,
        category: 'enemySkill',
      }),
    );
  }

  private loadUnitCatalogData() {
    try {
      const raw = fs.readFileSync(path.join(this.rootDir, 'data', 'unit-catalog.json'), 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  private loadBrowserConfig(relativeFilePath: string, globals: Record<string, any> = {}) {
    const absolutePath = path.join(this.rootDir, relativeFilePath);
    const code = fs.readFileSync(absolutePath, 'utf8');
    const unitCatalogData = this.loadUnitCatalogData();
    const sandbox: any = {
      window: {
        VersionManager: {
          getVersionedAssetUrl: (assetPath: string) => assetPath,
        },
        UnitCatalogLoader: {
          getData: () => unitCatalogData,
        },
      },
      Utils: {
        randomInt: () => 0,
        randomChoice: (items: any[]) => items?.[0],
      },
      Equipment: function Equipment() {},
      console,
      ...globals,
    };
    Object.assign(sandbox.window, globals);

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: absolutePath });
    return sandbox.window;
  }

  private async loadOverrides(): Promise<CatalogOverrides> {
    try {
      const raw = await fsp.readFile(this.overridesPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        resources: parsed.resources || {},
        items: parsed.items || {},
        equipment: parsed.equipment || {},
        gachaPools: parsed.gachaPools || {},
        shelterBuildings: parsed.shelterBuildings || {},
        dungeonChapters: parsed.dungeonChapters || {},
        dungeons: parsed.dungeons || {},
        enemySkills: parsed.enemySkills || {},
        shopItems: parsed.shopItems || {},
        welfareGifts: parsed.welfareGifts || {},
      };
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.warn('[GmCatalogService] load overrides failed:', error);
      }
      return {
        resources: {},
        items: {},
        equipment: {},
        gachaPools: {},
        shelterBuildings: {},
        dungeonChapters: {},
        dungeons: {},
        enemySkills: {},
        shopItems: {},
        welfareGifts: {},
      };
    }
  }

  private async saveOverrides(overrides: CatalogOverrides) {
    await fsp.mkdir(path.dirname(this.overridesPath), { recursive: true });
    await fsp.writeFile(this.overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
  }
}
