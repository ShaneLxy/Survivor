import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MongoService } from '../../shared/mongo/mongo.service';
import {
  MailAttachment,
  PlayerSaveDocument,
  UserAccountDocument,
} from '../../shared/mongo/mongo.types';
import { GmCatalogService } from '../gm/gm-catalog.service';
import { UpsertSaveDto } from './dto/upsert-save.dto';

type SaveWrapper = {
  version: string;
  timestamp: number;
  data: Record<string, any>;
};

type SaveState = {
  player: Record<string, any>;
  settings: Record<string, any>;
  heroData: Record<string, any>;
  shelterData: Record<string, any>;
  dungeonData: Record<string, any>;
  itemData: Record<string, any>;
  gachaData: Record<string, any>;
  shopData: Record<string, any>;
  checkinData: Record<string, any>;
  mailData: Record<string, any> | null;
  taskData: Record<string, any> | null;
  tutorialData: Record<string, any> | null;
  lastSaveTime: number;
};

@Injectable()
export class SaveService {
  constructor(
    private readonly mongoService: MongoService,
    private readonly gmCatalogService: GmCatalogService,
  ) {}

  async getSaveByAccountId(accountId: string) {
    const save = await this.getPlayerSave(accountId);
    if (!save?.saveData) {
      return {
        success: true,
        message: 'No cloud save found',
        saveData: null,
      };
    }

    return {
      success: true,
      message: 'Cloud save loaded',
      saveData: this.toSaveWrapper(save),
    };
  }

  async upsertSave(
    user: { id: string } | UserAccountDocument,
    dto: UpsertSaveDto,
  ) {
    const wrapper = this.normalizeIncomingWrapper(dto.saveData || {});
    const accountId = 'id' in user ? user.id : user._id;
    const existing = await this.getPlayerSave(accountId);

    if (
      existing?._id &&
      Number(existing.lastSaveTime || 0) > Number(wrapper.timestamp || 0)
    ) {
      return {
        success: true,
        message: 'Cloud save kept because remote data is newer',
        saveData: this.toSaveWrapper(existing),
      };
    }

    const saved = await this.writePlayerSave(
      accountId,
      wrapper,
      existing?._id || null,
    );

    return {
      success: true,
      message: 'Cloud save updated',
      saveData: saved,
    };
  }

  async buyShopItem(accountId: string, body: any) {
    const shopItemId = String(body?.shopItemId || '').trim();
    const quantity = Math.max(1, Number(body?.quantity) || 1);
    if (!shopItemId) {
      throw new BadRequestException('shopItemId is required');
    }

    const { wrapper, state, existingSave } = await this.loadStateForAction(accountId);
    const catalog = await this.gmCatalogService.getCatalog();
    const shopItems = Array.isArray(catalog?.shopItems) ? catalog.shopItems : [];
    const shopItem = shopItems.find((entry: any) => String(entry?.id || '').trim() === shopItemId);
    if (!shopItem) {
      throw new NotFoundException('Shop item not found');
    }

    this.ensureShopDailyReset(state);
    const maxBuy = Math.max(0, Number(shopItem?.maxBuy) || 0);
    const currentCount = Math.max(
      0,
      Number(state.shopData?.purchasedCounts?.[shopItemId]) || 0,
    );
    const remaining = Math.max(0, maxBuy - currentCount);
    if (remaining <= 0) {
      throw new BadRequestException('该商品今日已售罄');
    }
    if (quantity > remaining) {
      throw new BadRequestException(`超过剩余可购数量，当前剩余 ${remaining}`);
    }

    const currency = String(shopItem?.currency || 'gold').trim() || 'gold';
    const unitPrice = Math.max(0, Number(shopItem?.price) || 0);
    const totalPrice = unitPrice * quantity;
    const balance = this.getResourceCount(state, currency);
    if (balance < totalPrice) {
      throw new BadRequestException(`${currency} not enough`);
    }

    const rewards = this.resolveShopRewards(shopItem, quantity, state);
    this.consumeResource(state, currency, totalPrice);
    rewards.forEach((reward) => this.applyReward(state, reward));

    state.shopData.purchasedCounts[shopItemId] = currentCount + quantity;
    const updated = await this.persistActionState(accountId, wrapper, state, existingSave?._id || null);

    return {
      success: true,
      message: 'Shop purchase completed',
      saveData: updated,
      shopItemId,
      quantity,
      cost: { type: 'resource', id: currency, amount: totalPrice },
      remaining: Math.max(0, maxBuy - state.shopData.purchasedCounts[shopItemId]),
      rewards,
      serverTime: this.mongoService.nowIso(),
    };
  }

  async claimDailyCheckin(accountId: string) {
    const { wrapper, state, existingSave } = await this.loadStateForAction(accountId);
    const checkinData = this.ensureCheckinState(state);
    const today = this.getTodayKey();
    if (String(checkinData.lastCheckinDate || '') === today) {
      throw new BadRequestException('今日已签到');
    }

    const rewardsConfig = this.getDailyCheckinConfigs();
    const dailyRewards = this.getDailyFixedRewards();
    const claimedDay = this.normalizeCheckinDay(checkinData.checkinDay);
    const bonusConfig = rewardsConfig.find((entry) => Number(entry?.day) === claimedDay);
    if (!bonusConfig) {
      throw new BadRequestException('签到配置不存在');
    }

    const rewards = [
      ...dailyRewards.map((reward) => this.normalizeReward(reward)),
      ...this.expandRewards(bonusConfig?.rewards || [], state),
    ];
    rewards.forEach((reward) => this.applyReward(state, reward));

    checkinData.lastCheckinDate = today;
    checkinData.totalCheckins = Math.max(0, Number(checkinData.totalCheckins) || 0) + 1;
    checkinData.checkinDay = claimedDay >= 7 ? 1 : claimedDay + 1;

    const updated = await this.persistActionState(accountId, wrapper, state, existingSave?._id || null);
    return {
      success: true,
      message: 'Checkin completed',
      claimedDay,
      nextDay: checkinData.checkinDay,
      rewards,
      saveData: updated,
      serverTime: this.mongoService.nowIso(),
    };
  }

  async claimWelfareGift(accountId: string, body: any) {
    const giftId = String(body?.giftId || '').trim();
    const useAdSkipCard = Boolean(body?.useAdSkipCard);
    if (!giftId) {
      throw new BadRequestException('giftId is required');
    }

    const { wrapper, state, existingSave } = await this.loadStateForAction(accountId);
    const checkinData = this.ensureCheckinState(state);
    const catalog = await this.gmCatalogService.getCatalog();
    const gifts = Array.isArray(catalog?.welfareGifts) ? catalog.welfareGifts : [];
    const gift = gifts.find(
      (entry: any) =>
        String(entry?.id || '').trim() === giftId &&
        String(entry?.kind || 'gift').trim() !== 'monthCard',
    );
    if (!gift) {
      throw new NotFoundException('Welfare gift not found');
    }

    const usage = this.getWelfareGiftUsage(checkinData, gift);
    if (usage.remaining <= 0) {
      throw new BadRequestException('今日该礼包次数已达上限');
    }

    if (useAdSkipCard) {
      this.consumeAdSkipCard(state, 1);
    }

    const rewards = this.expandRewards(gift?.rewards || [], state);
    rewards.forEach((reward) => this.applyReward(state, reward));
    this.recordRewardVideoWatch(checkinData);
    this.recordWelfareGiftWatch(checkinData, giftId);
    this.tryActivateMonthCards(checkinData, gifts);

    const updated = await this.persistActionState(accountId, wrapper, state, existingSave?._id || null);
    return {
      success: true,
      message: 'Welfare gift claimed',
      giftId,
      useAdSkipCard,
      usage: this.getWelfareGiftUsage(checkinData, gift),
      rewards,
      saveData: updated,
      serverTime: this.mongoService.nowIso(),
    };
  }

  async claimMonthCard(accountId: string, body: any) {
    const cardId = String(body?.cardId || '').trim();
    if (!cardId) {
      throw new BadRequestException('cardId is required');
    }

    const { wrapper, state, existingSave } = await this.loadStateForAction(accountId);
    const checkinData = this.ensureCheckinState(state);
    const catalog = await this.gmCatalogService.getCatalog();
    const gifts = Array.isArray(catalog?.welfareGifts) ? catalog.welfareGifts : [];
    const card = gifts.find(
      (entry: any) =>
        String(entry?.id || '').trim() === cardId &&
        String(entry?.kind || '').trim() === 'monthCard',
    );
    if (!card) {
      throw new NotFoundException('Month card not found');
    }

    this.tryActivateMonthCards(checkinData, gifts);
    const status = this.getMonthCardStatus(checkinData, card);
    if (!status.active) {
      throw new BadRequestException('月卡尚未激活');
    }
    if (!status.canClaim) {
      throw new BadRequestException('今日已领取该月卡奖励');
    }

    const rewards = this.expandRewards(card?.dailyRewards || [], state);
    rewards.forEach((reward) => this.applyReward(state, reward));
    const cardState = this.ensureMonthCardState(checkinData, cardId);
    cardState.lastClaimDate = this.getTodayKey();

    const updated = await this.persistActionState(accountId, wrapper, state, existingSave?._id || null);
    return {
      success: true,
      message: 'Month card reward claimed',
      cardId,
      rewards,
      status: this.getMonthCardStatus(checkinData, card),
      saveData: updated,
      serverTime: this.mongoService.nowIso(),
    };
  }

  async deleteSave(accountId: string) {
    const collection = this.mongoService.playerSaves();
    await this.mongoService.removeWhere(collection, { accountId });
    return {
      success: true,
      message: 'Cloud save deleted',
    };
  }

  private async getPlayerSave(accountId: string) {
    const collection = this.mongoService.playerSaves();
    return (await this.mongoService.findOne(collection, {
      accountId,
    })) as PlayerSaveDocument | null;
  }

  private toSaveWrapper(save: PlayerSaveDocument): SaveWrapper {
    return {
      version: String(save.version || '2.0.0'),
      timestamp: Number(save.lastSaveTime || Date.now()),
      data: this.normalizeState(save.saveData || {}),
    };
  }

  private normalizeIncomingWrapper(rawWrapper: Record<string, any>): SaveWrapper {
    const data = this.normalizeState(rawWrapper?.data || {});
    const timestamp = Number(data.lastSaveTime || rawWrapper?.timestamp || Date.now());
    return {
      version: String(rawWrapper?.version || '2.0.0'),
      timestamp,
      data,
    };
  }

  private normalizeState(data: Record<string, any>): SaveState {
    return {
      player: { ...(data?.player || {}) },
      settings: { ...(data?.settings || {}) },
      heroData: {
        heroes: Array.isArray(data?.heroData?.heroes) ? data.heroData.heroes : [],
        team: Array.isArray(data?.heroData?.team) ? data.heroData.team : [],
        fragments: { ...(data?.heroData?.fragments || {}) },
      },
      shelterData: {
        buildings: Array.isArray(data?.shelterData?.buildings) ? data.shelterData.buildings : [],
        resources: { ...(data?.shelterData?.resources || {}) },
        offlineTime: Number(data?.shelterData?.offlineTime || Date.now()),
      },
      dungeonData: { ...(data?.dungeonData || {}) },
      itemData: {
        items: Array.isArray(data?.itemData?.items) ? data.itemData.items : [],
        equipment: Array.isArray(data?.itemData?.equipment) ? data.itemData.equipment : [],
      },
      gachaData: { ...(data?.gachaData || {}) },
      shopData: {
        lastResetDate: String(data?.shopData?.lastResetDate || '').trim(),
        purchasedCounts: { ...(data?.shopData?.purchasedCounts || {}) },
      },
      checkinData: {
        checkinDay: Math.max(1, Number(data?.checkinData?.checkinDay) || 1),
        lastCheckinDate: String(data?.checkinData?.lastCheckinDate || '').trim() || null,
        totalCheckins: Math.max(0, Number(data?.checkinData?.totalCheckins) || 0),
        welfareAdCounts: { ...(data?.checkinData?.welfareAdCounts || {}) },
        monthCardStates: { ...(data?.checkinData?.monthCardStates || {}) },
        rewardVideoStats: {
          monthKey: String(data?.checkinData?.rewardVideoStats?.monthKey || '').trim(),
          count: Math.max(0, Number(data?.checkinData?.rewardVideoStats?.count) || 0),
          total: Math.max(0, Number(data?.checkinData?.rewardVideoStats?.total) || 0),
        },
      },
      mailData: data?.mailData || null,
      taskData: data?.taskData || null,
      tutorialData: data?.tutorialData || null,
      lastSaveTime: Number(data?.lastSaveTime || Date.now()),
    };
  }

  private async writePlayerSave(
    accountId: string,
    wrapper: SaveWrapper,
    existingId: string | null,
  ) {
    const collection = this.mongoService.playerSaves();
    const now = this.mongoService.nowIso();
    const payload = {
      version: wrapper.version || '2.0.0',
      lastSaveTime: Number(wrapper.timestamp || Date.now()),
      saveData: this.normalizeState(wrapper.data),
      updatedAt: now,
    };

    if (existingId) {
      await this.mongoService.updateById(collection, existingId, payload);
    } else {
      await this.mongoService.insert(collection, {
        accountId,
        ...payload,
        createdAt: now,
      });
    }

    return {
      version: payload.version,
      timestamp: payload.lastSaveTime,
      data: payload.saveData,
    };
  }

  private async loadStateForAction(accountId: string) {
    const existingSave = await this.getPlayerSave(accountId);
    const wrapper = existingSave?.saveData
      ? this.toSaveWrapper(existingSave)
      : this.createDefaultSaveWrapper();
    const state = this.normalizeState(wrapper.data);
    return { wrapper, state, existingSave };
  }

  private async persistActionState(
    accountId: string,
    wrapper: SaveWrapper,
    state: SaveState,
    existingId: string | null,
  ) {
    const nextTimestamp = Date.now();
    return this.writePlayerSave(
      accountId,
      {
        version: wrapper.version || '2.0.0',
        timestamp: nextTimestamp,
        data: {
          ...state,
          lastSaveTime: nextTimestamp,
        },
      },
      existingId,
    );
  }

  private createDefaultSaveWrapper(): SaveWrapper {
    const now = Date.now();
    return {
      version: '2.0.0',
      timestamp: now,
      data: this.normalizeState({
        player: {
          level: 1,
          exp: 0,
          energy: 100,
          maxEnergy: 100,
          gold: 1000,
          diamond: 0,
          nickname: '幸存者',
          avatarHeroConfigId: null,
        },
        settings: {
          autoBattle: false,
          muted: false,
          environmentEffectsDisabled: false,
        },
        heroData: { heroes: [], team: [], fragments: {} },
        shelterData: {
          buildings: [],
          resources: {
            gold: 1000,
            wood: 50,
            stone: 30,
            meat: 80,
            iron_ore: 20,
            diamond: 0,
          },
          offlineTime: now,
        },
        itemData: { items: [], equipment: [] },
        gachaData: {},
        shopData: { lastResetDate: '', purchasedCounts: {} },
        checkinData: {
          checkinDay: 1,
          lastCheckinDate: null,
          totalCheckins: 0,
          welfareAdCounts: {},
          monthCardStates: {},
          rewardVideoStats: { monthKey: '', count: 0, total: 0 },
        },
        mailData: null,
        taskData: null,
        tutorialData: null,
        lastSaveTime: now,
      }),
    };
  }

  private getTodayKey() {
    return new Date().toDateString();
  }

  private getMonthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private normalizeCheckinDay(day: any) {
    const normalized = Math.floor(Number(day) || 1);
    if (normalized < 1) {
      return 1;
    }
    return ((normalized - 1) % 7) + 1;
  }

  private ensureShopDailyReset(state: SaveState) {
    const today = this.getTodayKey();
    state.shopData = state.shopData || { lastResetDate: '', purchasedCounts: {} };
    if (String(state.shopData.lastResetDate || '') !== today) {
      state.shopData.lastResetDate = today;
      state.shopData.purchasedCounts = {};
    }
  }

  private ensureCheckinState(state: SaveState) {
    if (!state.checkinData) {
      state.checkinData = {
        checkinDay: 1,
        lastCheckinDate: null,
        totalCheckins: 0,
        welfareAdCounts: {},
        monthCardStates: {},
        rewardVideoStats: { monthKey: '', count: 0, total: 0 },
      };
    }
    if (!state.checkinData.welfareAdCounts) {
      state.checkinData.welfareAdCounts = {};
    }
    if (!state.checkinData.monthCardStates) {
      state.checkinData.monthCardStates = {};
    }
    if (!state.checkinData.rewardVideoStats) {
      state.checkinData.rewardVideoStats = { monthKey: '', count: 0, total: 0 };
    }
    state.checkinData.checkinDay = this.normalizeCheckinDay(state.checkinData.checkinDay);
    return state.checkinData;
  }

  private getResourceCount(state: SaveState, resourceId: string) {
    return Math.max(0, Number(state?.shelterData?.resources?.[resourceId]) || 0);
  }

  private consumeResource(state: SaveState, resourceId: string, amount: number) {
    const current = this.getResourceCount(state, resourceId);
    state.shelterData.resources[resourceId] = Math.max(0, current - Math.max(0, amount || 0));
    if (resourceId === 'gold') {
      state.player.gold = state.shelterData.resources[resourceId];
    }
    if (resourceId === 'diamond') {
      state.player.diamond = state.shelterData.resources[resourceId];
    }
  }

  private addResource(state: SaveState, resourceId: string, amount: number) {
    if (!state.shelterData.resources[resourceId]) {
      state.shelterData.resources[resourceId] = 0;
    }
    state.shelterData.resources[resourceId] += Math.max(0, amount || 0);
    if (resourceId === 'gold') {
      state.player.gold = state.shelterData.resources[resourceId];
    }
    if (resourceId === 'diamond') {
      state.player.diamond = state.shelterData.resources[resourceId];
    }
  }

  private addItem(state: SaveState, itemId: string, amount: number) {
    const count = Math.max(0, Number(amount) || 0);
    if (count <= 0) {
      return;
    }
    const items = Array.isArray(state.itemData.items) ? state.itemData.items : [];
    const existing = items.find((entry: any) => String(entry?.id || '').trim() === itemId);
    if (existing) {
      existing.count = Math.max(0, Number(existing.count) || 0) + count;
      return;
    }
    items.push({ id: itemId, count });
    state.itemData.items = items;
  }

  private getItemCount(state: SaveState, itemId: string) {
    return (Array.isArray(state?.itemData?.items) ? state.itemData.items : [])
      .filter((entry: any) => String(entry?.id || '').trim() === itemId)
      .reduce((total: number, entry: any) => total + Math.max(0, Number(entry?.count) || 0), 0);
  }

  private removeItem(state: SaveState, itemId: string, amount: number) {
    let remaining = Math.max(0, Number(amount) || 0);
    if (remaining <= 0) {
      return;
    }

    const items = Array.isArray(state?.itemData?.items) ? state.itemData.items : [];
    for (const entry of items) {
      if (remaining <= 0) {
        break;
      }
      if (String(entry?.id || '').trim() !== itemId) {
        continue;
      }
      const current = Math.max(0, Number(entry?.count) || 0);
      const consumed = Math.min(current, remaining);
      entry.count = current - consumed;
      remaining -= consumed;
    }

    state.itemData.items = items.filter((entry: any) => Math.max(0, Number(entry?.count) || 0) > 0);
    if (remaining > 0) {
      throw new BadRequestException("ad_skip_card not enough");
    }
  }

  private consumeAdSkipCard(state: SaveState, amount = 1) {
    const required = Math.max(1, Number(amount) || 1);
    if (this.getItemCount(state, 'ad_skip_card') < required) {
      throw new BadRequestException('ad skip card not enough');
    }
    this.removeItem(state, 'ad_skip_card', required);
  }

  private addFragments(state: SaveState, heroId: string, amount: number) {
    const count = Math.max(0, Number(amount) || 0);
    if (count <= 0) {
      return;
    }
    const fragments = state.heroData.fragments || {};
    fragments[heroId] = Math.max(0, Number(fragments[heroId]) || 0) + count;
    state.heroData.fragments = fragments;
  }

  private normalizeReward(reward: any): MailAttachment {
    return {
      type: String(reward?.type || 'item').trim() === 'resource' ? 'resource' : 'item',
      id: String(reward?.id || '').trim(),
      amount: Math.max(1, Number(reward?.count ?? reward?.amount ?? 1) || 1),
    };
  }

  private applyReward(state: SaveState, reward: MailAttachment) {
    if (!reward?.id) {
      return;
    }
    if (reward.type === 'resource') {
      this.addResource(state, reward.id, reward.amount);
      return;
    }
    if (String(reward.id).endsWith('_fragment')) {
      const heroId = reward.id.replace(/_fragment$/, '');
      this.addFragments(state, heroId, reward.amount);
      return;
    }
    this.addItem(state, reward.id, reward.amount);
  }

  private resolveShopRewards(
    shopItem: any,
    quantity: number,
    state: SaveState,
  ): MailAttachment[] {
    const type = String(shopItem?.type || '').trim();
    const giveItem = String(shopItem?.giveItem || '').trim();
    const giveCount = Math.max(1, Number(shopItem?.giveCount) || 1) * quantity;

    if (type === 'resource') {
      return [{ type: 'resource' as const, id: giveItem, amount: giveCount }];
    }
    if (type === 'consumable') {
      return [{ type: 'item' as const, id: giveItem, amount: giveCount }];
    }
    if (type === 'fragment') {
      return this.generateFragmentRewards(giveItem, giveCount, state);
    }
    throw new BadRequestException('Unknown shop item type');
  }

  private generateFragmentRewards(
    fragmentType: string,
    total: number,
    state: SaveState,
  ): MailAttachment[] {
    const catalogHeroes = Array.isArray(state.heroData?.heroes) ? state.heroData.heroes : [];
    const allHeroIds = catalogHeroes
      .map((hero: any) => String(hero?.configId || hero?.id || '').trim())
      .filter(Boolean);

    const candidates = allHeroIds.length > 0
      ? allHeroIds
      : ['hero_001'];

    const rewardMap = new Map<string, number>();
    for (let index = 0; index < total; index++) {
      const heroId = candidates[index % candidates.length];
      rewardMap.set(heroId, (rewardMap.get(heroId) || 0) + 1);
    }
    return [...rewardMap.entries()].map(([heroId, amount]) => {
      void fragmentType;
      return {
        type: 'item' as const,
        id: `${heroId}_fragment`,
        amount,
      };
    });
  }

  private getDailyCheckinConfigs() {
    return [
      { day: 1, rewards: [{ type: 'resource', id: 'gold', count: 100 }] },
      { day: 2, rewards: [{ type: 'resource', id: 'wood', count: 50 }] },
      { day: 3, rewards: [{ type: 'item', id: 'energy_potion', count: 1 }] },
      { day: 4, rewards: [{ type: 'item', id: 'hero_summon', count: 1 }] },
      { day: 5, rewards: [{ type: 'resource', id: 'gold', count: 200 }] },
      { day: 6, rewards: [{ type: 'resource', id: 'meat', count: 3 }] },
      { day: 7, rewards: [{ type: 'random_fragments', total: 50 }] },
    ];
  }

  private getDailyFixedRewards() {
    return [
      { type: 'resource', id: 'diamond', count: 100 },
      { type: 'item', id: 'stimulant', count: 1 },
      { type: 'resource', id: 'meat', count: 10 },
    ];
  }

  private expandRewards(rewards: any[], state: SaveState) {
    const result: MailAttachment[] = [];
    (Array.isArray(rewards) ? rewards : []).forEach((reward) => {
      const type = String(reward?.type || '').trim();
      if (type === 'random_fragments') {
        const total = Math.max(1, Number(reward?.total ?? reward?.count ?? 1) || 1);
        result.push(...this.generateFragmentRewards('random_fragment', total, state));
        return;
      }
      if (type === 'fragment') {
        const itemId = String(reward?.id || '').trim();
        result.push({
          type: 'item',
          id: itemId,
          amount: Math.max(1, Number(reward?.count ?? reward?.amount ?? 1) || 1),
        });
        return;
      }
      result.push(this.normalizeReward(reward));
    });
    return result;
  }

  private getWelfareGiftUsage(checkinData: any, gift: any) {
    const today = this.getTodayKey();
    const giftId = String(gift?.id || '').trim();
    const saved = checkinData.welfareAdCounts?.[giftId] || { date: '', count: 0 };
    const used = saved.date === today ? Math.max(0, Number(saved.count) || 0) : 0;
    const limit = this.getWelfareAdLimit(checkinData, gift?.adLimits || {});
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  }

  private getWelfareAdLimit(checkinData: any, adLimits: any) {
    const tier = this.getMonthCardTier(checkinData);
    const map = {
      normal: Math.max(0, Number(adLimits?.normal ?? 3) || 0),
      welfare: Math.max(0, Number(adLimits?.welfare ?? 4) || 0),
      supreme: Math.max(0, Number(adLimits?.supreme ?? 5) || 0),
    };
    if (tier === 'supreme') {
      return Math.max(0, Number(map.supreme ?? map.welfare ?? map.normal) || 0);
    }
    if (tier === 'welfare') {
      return Math.max(0, Number(map.welfare ?? map.normal) || 0);
    }
    return Math.max(0, Number(map.normal) || 0);
  }

  private ensureRewardVideoStats(checkinData: any) {
    const currentMonthKey = this.getMonthKey();
    const stats = checkinData.rewardVideoStats || {
      monthKey: currentMonthKey,
      count: 0,
      total: 0,
    };
    if (String(stats.monthKey || '') !== currentMonthKey) {
      checkinData.rewardVideoStats = {
        monthKey: currentMonthKey,
        count: 0,
        total: Math.max(0, Number(stats.total) || 0),
      };
    } else {
      checkinData.rewardVideoStats = {
        monthKey: currentMonthKey,
        count: Math.max(0, Number(stats.count) || 0),
        total: Math.max(0, Number(stats.total) || 0),
      };
    }
    return checkinData.rewardVideoStats;
  }

  private recordRewardVideoWatch(checkinData: any) {
    const stats = this.ensureRewardVideoStats(checkinData);
    stats.count += 1;
    stats.total += 1;
    checkinData.rewardVideoStats = stats;
    return stats;
  }

  private recordWelfareGiftWatch(checkinData: any, giftId: string) {
    const today = this.getTodayKey();
    const current = checkinData.welfareAdCounts?.[giftId] || { date: today, count: 0 };
    const nextCount =
      current.date === today ? Math.max(0, Number(current.count) || 0) + 1 : 1;
    checkinData.welfareAdCounts[giftId] = {
      date: today,
      count: nextCount,
    };
  }

  private ensureMonthCardState(checkinData: any, cardId: string) {
    if (!checkinData.monthCardStates[cardId]) {
      checkinData.monthCardStates[cardId] = {
        active: false,
        activatedAt: '',
        expiresAt: '',
        watchedToday: 0,
        watchedMonth: 0,
        totalWatched: 0,
        lastWatchDate: '',
        watchMonthKey: '',
        lastClaimDate: '',
      };
    }
    return checkinData.monthCardStates[cardId];
  }

  private refreshMonthCardActiveState(state: any, now = new Date()) {
    if (!state?.active || !state.expiresAt) {
      return;
    }
    const expiresAt = Date.parse(String(state.expiresAt || ''));
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
      state.active = false;
    }
  }

  private activateMonthCard(state: any, cardConfig: any) {
    if (!state || state.active) {
      return;
    }
    const now = new Date();
    const durationDays = Math.max(1, Number(cardConfig?.durationDays ?? 30) || 30);
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    state.active = true;
    state.activatedAt = now.toISOString();
    state.expiresAt = expiresAt.toISOString();
  }

  private tryActivateMonthCards(checkinData: any, gifts: any[]) {
    const currentMonthViews = Math.max(
      0,
      Number(this.ensureRewardVideoStats(checkinData).count) || 0,
    );
    gifts
      .filter((entry: any) => String(entry?.kind || '').trim() === 'monthCard')
      .forEach((card: any) => {
        const requiredViews = Math.max(
          1,
          Number(card?.requiredViews ?? card?.activationViews ?? 1) || 1,
        );
        const state = this.ensureMonthCardState(checkinData, String(card?.id || ''));
        this.refreshMonthCardActiveState(state);
        if (!state.active && currentMonthViews >= requiredViews) {
          this.activateMonthCard(state, card);
        }
      });
  }

  private getMonthCardTier(checkinData: any) {
    const supreme = this.ensureMonthCardState(checkinData, 'supreme_month_card');
    const welfare = this.ensureMonthCardState(checkinData, 'welfare_month_card');
    this.refreshMonthCardActiveState(supreme);
    this.refreshMonthCardActiveState(welfare);
    if (supreme.active) {
      return 'supreme';
    }
    if (welfare.active) {
      return 'welfare';
    }
    return 'none';
  }

  private getMonthCardStatus(checkinData: any, card: any) {
    const today = this.getTodayKey();
    const currentMonthKey = this.getMonthKey();
    const cardId = String(card?.id || '').trim();
    const state = this.ensureMonthCardState(checkinData, cardId);
    this.refreshMonthCardActiveState(state);
    const requiredViews = Math.max(
      1,
      Number(card?.requiredViews ?? card?.activationViews ?? 1) || 1,
    );
    const rewardVideoStats = this.ensureRewardVideoStats(checkinData);
    const watchedMonth = Math.max(0, Number(rewardVideoStats.count) || 0);
    if (!state.active && watchedMonth >= requiredViews) {
      this.activateMonthCard(state, card);
    }
    return {
      id: cardId,
      active: Boolean(state.active),
      requiredViews,
      watchedMonth,
      canClaim: Boolean(state.active) && String(state.lastClaimDate || '') !== today,
      remainingViews: Math.max(0, requiredViews - watchedMonth),
      activatedAt: String(state.activatedAt || ''),
      expiresAt: String(state.expiresAt || ''),
      watchMonthKey: currentMonthKey,
      durationDays: Math.max(1, Number(card?.durationDays ?? 30) || 30),
    };
  }
}
