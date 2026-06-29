import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { ObjectId } from 'mongodb';
import { MongoService } from '../../shared/mongo/mongo.service';
import {
  CdkeyDocument,
  GameOperationAnnouncement,
  GameOperationConfigDocument,
  MailAttachment,
  PlayerMailDocument,
  UserAccountDocument,
  UserAccountSaveAuditBypass,
} from '../../shared/mongo/mongo.types';

@Injectable()
export class GmService {
  private readonly rootDir = path.resolve(__dirname, '../../../../');
  private readonly cacheBustTargets = [
    path.join(this.rootDir, 'index.html'),
    path.join(this.rootDir, 'mobile', 'web', 'index.html'),
  ];
  private readonly specialBattleConfigFile = path.join(
    this.rootDir,
    'server',
    'data',
    'gm-special-battles.json',
  );

  constructor(private readonly mongoService: MongoService) {}

  async getOperationConfig() {
    const config = await this.loadOperationConfig();
    return {
      success: true,
      config: this.serializeOperationConfig(config),
    };
  }

  async updateOperationConfig(body: any) {
    const now = this.mongoService.nowIso();
    const current = await this.loadOperationConfig();
    const next: GameOperationConfigDocument = {
      ...current,
      gameStatus: this.normalizeGameStatus(body?.gameStatus),
      announcements: this.normalizeAnnouncements(body?.announcements),
      updatedAt: now,
    };

    await this.mongoService.operationConfigs().updateOne(
      { _id: 'global' } as any,
      {
        $set: {
          gameStatus: next.gameStatus,
          announcements: next.announcements,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: 'global',
          createdAt: current.createdAt || now,
        },
      },
      { upsert: true },
    );

    return {
      success: true,
      config: this.serializeOperationConfig(next),
    };
  }

  private async loadOperationConfig(): Promise<GameOperationConfigDocument> {
    const now = this.mongoService.nowIso();
    const doc = (await this.mongoService.findOne(
      this.mongoService.operationConfigs(),
      { _id: 'global' } as any,
    )) as GameOperationConfigDocument | null;

    if (doc) {
      return {
        _id: 'global',
        gameStatus: this.normalizeGameStatus(doc.gameStatus),
        announcements: this.normalizeAnnouncements(doc.announcements),
        createdAt: doc.createdAt || now,
        updatedAt: doc.updatedAt || now,
      };
    }

    return {
      _id: 'global',
      gameStatus: 'normal',
      announcements: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private serializeOperationConfig(config: GameOperationConfigDocument) {
    return {
      gameStatus: this.normalizeGameStatus(config.gameStatus),
      announcements: this.normalizeAnnouncements(config.announcements),
      updatedAt: config.updatedAt || null,
    };
  }

  private normalizeGameStatus(value: any) {
    return String(value || '').trim() === 'maintenance' ? 'maintenance' : 'normal';
  }

  private normalizeAnnouncements(value: any): GameOperationAnnouncement[] {
    const list = Array.isArray(value) ? value : [];
    return list
      .slice(0, 3)
      .map((entry, index) => {
        const id = String(entry?.id || '').trim() || `announcement_${index + 1}`;
        const title = String(entry?.title || '').trim().slice(0, 24);
        const content = String(entry?.content || '').trim().slice(0, 5000);
        return {
          id,
          title,
          content,
          order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : index + 1,
        };
      })
      .filter((entry) => entry.title || entry.content)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  async bumpCacheVersion(rawVersion?: string) {
    const version = this.normalizeBumpVersion(rawVersion);
    const results: { file: string; replaced: number }[] = [];

    for (const file of this.cacheBustTargets) {
      if (!fs.existsSync(file)) {
        continue;
      }
      const content = await fsp.readFile(file, 'utf8');
      const matches = content.match(/\?v=[\d.]+/g) || [];
      if (matches.length === 0) {
        results.push({ file: path.relative(this.rootDir, file), replaced: 0 });
        continue;
      }
      const replaced = content.replace(/\?v=[\d.]+/g, `?v=${version}`);
      await fsp.writeFile(file, replaced, 'utf8');
      results.push({ file: path.relative(this.rootDir, file), replaced: matches.length });
    }

    return {
      success: true,
      version,
      results,
    };
  }

  private normalizeBumpVersion(input?: string) {
    const trimmed = String(input || '').trim();
    if (trimmed && /^[\d.]{3,}$/.test(trimmed)) {
      return trimmed;
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    return `${y}.${m}.${d}.${minuteOfDay}`;
  }

  async getAudioConfig() {
    const config = await this.loadAudioConfig();
    return { success: true, config };
  }

  async updateAudioConfig(body: any) {
    const current = await this.loadAudioConfig();
    const next = {
      battleBgmPath: this.normalizeBgmPath(body?.battleBgmPath, current.battleBgmPath),
      lobbyBgmPath: this.normalizeBgmPath(body?.lobbyBgmPath, current.lobbyBgmPath),
      attackSfxPaths: this.normalizeAudioPathList(body?.attackSfxPaths, current.attackSfxPaths),
      criticalSfxPaths: this.normalizeAudioPathList(body?.criticalSfxPaths, current.criticalSfxPaths),
    };
    await fsp.writeFile(this.audioConfigPath(), JSON.stringify(next, null, 2), 'utf8');
    return { success: true, config: next };
  }

  async uploadAudioFile(file: Express.Multer.File, category?: string) {
    if (!file || !file.buffer || file.size <= 0) {
      throw new BadRequestException('未选择音频文件');
    }
    const allowed = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac']);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(`不支持的音频格式: ${file.mimetype || '未知'}`);
    }
    const normalizedCategory = this.normalizeAudioUploadCategory(category);
    const targetDir = normalizedCategory === 'bgm' ? 'bgm' : 'sfx';
    const destDir = path.join(this.rootDir, 'assets', 'audio', targetDir);
    await fsp.mkdir(destDir, { recursive: true });
    const ext = path.extname(file.originalname || 'audio.mp3') || '.mp3';
    const safeName = this.buildUploadedAudioName(normalizedCategory, ext);
    const destPath = path.join(destDir, safeName);
    await fsp.writeFile(destPath, file.buffer);
    const relativePath = `assets/audio/${targetDir}/${safeName}`;

    const config = await this.loadAudioConfig();
    if (normalizedCategory === 'battle_attack') {
      config.attackSfxPaths = [...config.attackSfxPaths, relativePath];
    } else if (normalizedCategory === 'battle_critical') {
      config.criticalSfxPaths = [...config.criticalSfxPaths, relativePath];
    } else {
      config.battleBgmPath = relativePath;
    }
    await fsp.writeFile(this.audioConfigPath(), JSON.stringify(config, null, 2), 'utf8');

    return { success: true, path: relativePath, category: normalizedCategory, config };
  }

  private audioConfigPath() {
    return path.join(this.rootDir, 'server', 'gm-audio-config.json');
  }

  private async loadAudioConfig(): Promise<{
    battleBgmPath: string;
    lobbyBgmPath: string;
    attackSfxPaths: string[];
    criticalSfxPaths: string[];
  }> {
    const configPath = this.audioConfigPath();
    try {
      const raw = await fsp.readFile(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        battleBgmPath: this.normalizeBgmPath(parsed?.battleBgmPath, 'assets/audio/bgm/ParadiseBGM.MP3'),
        lobbyBgmPath: this.normalizeBgmPath(parsed?.lobbyBgmPath, 'assets/audio/bgm/ParadiseBGM.MP3'),
        attackSfxPaths: this.normalizeAudioPathList(parsed?.attackSfxPaths),
        criticalSfxPaths: this.normalizeAudioPathList(parsed?.criticalSfxPaths),
      };
    } catch {
      return {
        battleBgmPath: 'assets/audio/bgm/ParadiseBGM.MP3',
        lobbyBgmPath: 'assets/audio/bgm/ParadiseBGM.MP3',
        attackSfxPaths: [],
        criticalSfxPaths: [],
      };
    }
  }

  private normalizeBgmPath(value: string, fallback: string) {
    const trimmed = String(value || '').trim();
    return trimmed ? trimmed : fallback;
  }

  private normalizeAudioPathList(value: any, fallback: string[] = []) {
    if (typeof value === 'undefined') {
      return Array.isArray(fallback) ? [...fallback] : [];
    }
    if (value === null) {
      return [];
    }
    const list = Array.isArray(value) ? value : String(value).split(/[\r\n,;，；]+/);
    return list.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  private normalizeAudioUploadCategory(value: any) {
    const category = String(value || '').trim();
    if (category === 'battle_attack' || category === 'battle_critical') {
      return category;
    }
    return 'bgm';
  }

  private buildUploadedAudioName(category: string, ext: string) {
    const stamp = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    if (category === 'battle_attack') {
      return `gm_battle_attack_${stamp}${ext}`;
    }
    if (category === 'battle_critical') {
      return `gm_battle_critical_${stamp}${ext}`;
    }
    return `gm_battle_bgm${ext}`;
  }

  async listPlayers(query: any = {}) {
    const keyword = String(query.keyword || '').trim();
    const limit = this.clampLimit(query.limit, 100);
    const searchItems: any[] = keyword
      ? [
          { account: { $regex: keyword, $options: 'i' } },
          { nickname: { $regex: keyword, $options: 'i' } },
          { _id: keyword },
        ]
      : [];
    if (keyword && ObjectId.isValid(keyword)) {
      searchItems.push({ _id: new ObjectId(keyword) });
    }
    const where = keyword
      ? {
          $or: searchItems,
        }
      : {};

    const players = (await this.mongoService
      .userAccounts()
      .find(where)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray()) as unknown as UserAccountDocument[];

    return {
      success: true,
      players: players.map((player: any) => this.serializePlayer(player)),
    };
  }

  async updatePlayerBanStatus(id: string, body: any) {
    const player = (await this.mongoService.getById(
      this.mongoService.userAccounts(),
      id,
    )) as UserAccountDocument | null;
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const now = this.mongoService.nowIso();
    const banned = body?.banned === true;
    const reason = String(body?.reason || '').trim() || 'GM 手动封禁';
    const details =
      body?.details && typeof body.details === 'object' ? body.details : null;

    await this.mongoService.updateById(this.mongoService.userAccounts(), id, {
      banStatus: banned
        ? {
            bannedAt: now,
            reason,
            details,
          }
        : null,
      updatedAt: now,
    } as any);

    const next = await this.mongoService.getById(
      this.mongoService.userAccounts(),
      id,
    );
    return {
      success: true,
      player: this.serializePlayer(next as any),
    };
  }

  async updatePlayerSaveAuditBypass(id: string, body: any) {
    const player = (await this.mongoService.getById(
      this.mongoService.userAccounts(),
      id,
    )) as UserAccountDocument | null;
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const now = this.mongoService.nowIso();
    const enabled = body?.enabled === true;
    const note = String(body?.note || '').trim() || 'GM 测试免审';
    const saveAuditBypass: UserAccountSaveAuditBypass | null = enabled
      ? {
          enabled: true,
          note,
          updatedAt: now,
        }
      : null;

    await this.mongoService.updateById(this.mongoService.userAccounts(), id, {
      saveAuditBypass,
      updatedAt: now,
    } as any);

    const next = await this.mongoService.getById(
      this.mongoService.userAccounts(),
      id,
    );
    return {
      success: true,
      player: this.serializePlayer(next as any),
    };
  }

  private serializePlayer(player: any) {
    if (!player) {
      return null;
    }
    const banStatus = player?.banStatus?.bannedAt
      ? {
          bannedAt: player.banStatus.bannedAt,
          reason: player.banStatus.reason || '存档异常',
          details: player.banStatus.details || null,
        }
      : null;
    const saveAuditBypass = player?.saveAuditBypass?.enabled
      ? {
          enabled: true,
          note: player.saveAuditBypass.note || null,
          updatedAt: player.saveAuditBypass.updatedAt || null,
        }
      : null;

    return {
      id: String(player._id || ''),
      account: player.account || '',
      nickname: player.nickname || '',
      loginType: player.loginType || '',
      lastLoginAt: player.lastLoginAt || null,
      createdAt: player.createdAt || null,
      updatedAt: player.updatedAt || null,
      banStatus,
      saveAuditBypass,
    };
  }

  async sendMail(body: any) {
    const title = String(body?.title || '').trim();
    const mailBody = String(body?.body || '').trim();
    if (!title) {
      throw new BadRequestException('Mail title is required');
    }

    const attachments = this.normalizeAttachments(body?.attachments);
    const accountIds = await this.resolveMailTargets(body);
    if (accountIds.length === 0) {
      throw new BadRequestException('No target players found');
    }

    const now = this.mongoService.nowIso();
    const expireAt = this.normalizeExpireAt(body?.expireAt);
    const docs = accountIds.map((accountId) => ({
      accountId,
      title,
      body: mailBody,
      sender: String(body?.sender || 'GM'),
      attachments,
      expireAt,
      readAt: null,
      claimedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await this.mongoService.playerMails().insertMany(docs as any[]);
    return {
      success: true,
      targetCount: accountIds.length,
      insertedCount: result.insertedCount,
    };
  }

  async listMails(query: any = {}) {
    const accountId = String(query.accountId || '').trim();
    const limit = this.clampLimit(query.limit, 100);
    const where = accountId ? { accountId } : {};
    const mails = (await this.mongoService
      .playerMails()
      .find(where)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()) as unknown as PlayerMailDocument[];

    return {
      success: true,
      mails: mails.map((mail: any) => ({
        id: String(mail._id),
        accountId: mail.accountId,
        title: mail.title || '',
        body: mail.body || '',
        sender: mail.sender || '',
        attachments: this.normalizeAttachments(mail.attachments),
        expireAt: mail.expireAt || null,
        readAt: mail.readAt || null,
        claimedAt: mail.claimedAt || null,
        createdAt: mail.createdAt || null,
        updatedAt: mail.updatedAt || null,
      })),
    };
  }

  async listCdkeys(query: any = {}) {
    const where: any = {};
    const keyword = String(query.keyword || '').trim();
    if (keyword) {
      where.$or = [
        { code: { $regex: keyword.toUpperCase(), $options: 'i' } },
        { title: { $regex: keyword, $options: 'i' } },
        { batchId: { $regex: keyword, $options: 'i' } },
      ];
    }
    if (query.used === 'true') {
      where.used = true;
    } else if (query.used === 'false') {
      where.used = { $ne: true };
    }
    if (query.enabled === 'true') {
      where.enabled = { $ne: false };
    } else if (query.enabled === 'false') {
      where.enabled = false;
    }

    const limit = this.clampLimit(query.limit, 200);
    const cdkeys = (await this.mongoService
      .cdkeys()
      .find(where)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()) as unknown as CdkeyDocument[];

    return {
      success: true,
      cdkeys: cdkeys.map((entry: any) => this.serializeCdkey(entry)),
    };
  }

  async createCdkeys(body: any) {
    const rewards = this.normalizeAttachments(body?.rewards);
    if (rewards.length === 0) {
      throw new BadRequestException('At least one reward is required');
    }

    const codes = this.resolveCdkeyCodes(body);
    if (codes.length === 0) {
      throw new BadRequestException('No cdkey codes were provided');
    }

    const uniqueCodes = [...new Set(codes.map((code) => this.normalizeCode(code)).filter(Boolean))];
    const existing = await this.mongoService
      .cdkeys()
      .find({ code: { $in: uniqueCodes } })
      .project({ code: 1 })
      .toArray();
    const existingCodes = new Set(existing.map((entry: any) => entry.code));
    const now = this.mongoService.nowIso();
    const batchId =
      String(body?.batchId || '').trim() || `GM-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
    const docs = uniqueCodes
      .filter((code) => !existingCodes.has(code))
      .map((code) => ({
        code,
        title: String(body?.title || '').trim() || null,
        rewards,
        used: false,
        usedByAccountId: null,
        usedAt: null,
        expireAt: this.normalizeExpireAt(body?.expireAt),
        enabled: body?.enabled === false ? false : true,
        batchId,
        remark: String(body?.remark || '').trim() || null,
        createdAt: now,
        updatedAt: now,
      }));

    if (docs.length > 0) {
      await this.mongoService.cdkeys().insertMany(docs as any[], { ordered: false });
    }

    return {
      success: true,
      batchId,
      requestedCount: uniqueCodes.length,
      insertedCount: docs.length,
      skippedDuplicates: uniqueCodes.length - docs.length,
      cdkeys: docs.map((entry: any) => this.serializeCdkey(entry)),
    };
  }

  async updateCdkey(id: string, body: any) {
    const update = this.buildCdkeyUpdate(body);
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('No cdkey fields to update');
    }
    update.updatedAt = this.mongoService.nowIso();
    await this.mongoService.updateById(this.mongoService.cdkeys(), id, update);
    const next = await this.mongoService.getById(this.mongoService.cdkeys(), id);
    return {
      success: true,
      cdkey: this.serializeCdkey(next as any),
    };
  }

  async batchUpdateCdkeys(body: any) {
    const codes = (Array.isArray(body?.codes) ? body.codes : [])
      .map((code) => this.normalizeCode(code))
      .filter(Boolean);
    if (codes.length === 0) {
      throw new BadRequestException('No cdkey codes were provided');
    }

    const update = this.buildCdkeyUpdate(body?.update || body);
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('No cdkey fields to update');
    }
    update.updatedAt = this.mongoService.nowIso();
    const result = await this.mongoService.cdkeys().updateMany(
      { code: { $in: [...new Set(codes)] } },
      {
        $set: update,
      },
    );

    return {
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  private async resolveMailTargets(body: any) {
    if (body?.scope === 'all') {
      const users = (await this.mongoService
        .userAccounts()
        .find({})
        .project({ _id: 1 })
      .toArray()) as unknown as UserAccountDocument[];
      return users.map((entry: any) => String(entry._id));
    }

    const ids = Array.isArray(body?.accountIds)
      ? body.accountIds
      : String(body?.accountIds || '')
          .split(/[\s,;，；]+/)
          .filter(Boolean);

    return [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
  }

  private normalizeAttachments(attachments: any): MailAttachment[] {
    return (Array.isArray(attachments) ? attachments : [])
      .map((entry) => ({
        type: this.normalizeRewardType(entry?.type),
        id: String(entry?.id || '').trim(),
        amount: Math.max(0, Number(entry?.amount) || 0),
      }))
      .filter((entry) => entry.id && entry.amount > 0);
  }

  private normalizeRewardType(type: any): MailAttachment['type'] {
    if (type === 'resource') {
      return 'resource';
    }
    if (type === 'fragment') {
      return 'fragment';
    }
    return 'item';
  }

  private normalizeExpireAt(value: any) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  private resolveCdkeyCodes(body: any) {
    const manualCodes = Array.isArray(body?.codes)
      ? body.codes
      : String(body?.codes || '')
          .split(/[\s,;，；]+/)
          .filter(Boolean);
    const generatedCount = Math.max(0, Math.min(5000, Number(body?.count) || 0));
    const prefix = String(body?.prefix || '').trim().toUpperCase();
    const generatedCodes = Array.from({ length: generatedCount }, () =>
      this.generateCode(prefix),
    );
    return [...manualCodes, ...generatedCodes];
  }

  private generateCode(prefix = '') {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments = Array.from({ length: 3 }, () =>
      Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(''),
    );
    return [prefix, ...segments].filter(Boolean).join('-');
  }

  private normalizeCode(code: any) {
    return String(code || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  private buildCdkeyUpdate(body: any) {
    const update: any = {};
    if ('code' in body) {
      const code = this.normalizeCode(body.code);
      if (code) {
        update.code = code;
      }
    }
    if ('title' in body) {
      update.title = String(body.title || '').trim() || null;
    }
    if ('rewards' in body) {
      update.rewards = this.normalizeAttachments(body.rewards);
    }
    if ('expireAt' in body) {
      update.expireAt = this.normalizeExpireAt(body.expireAt);
    }
    if ('enabled' in body) {
      update.enabled = body.enabled !== false;
    }
    if ('remark' in body) {
      update.remark = String(body.remark || '').trim() || null;
    }
    if ('batchId' in body) {
      update.batchId = String(body.batchId || '').trim() || null;
    }
    return update;
  }

  private serializeCdkey(entry: any) {
    if (!entry) {
      return null;
    }
    return {
      id: String(entry._id || ''),
      code: entry.code,
      title: entry.title || '',
      rewards: this.normalizeAttachments(entry.rewards),
      used: Boolean(entry.used),
      usedByAccountId: entry.usedByAccountId || null,
      usedAt: entry.usedAt || null,
      expireAt: entry.expireAt || null,
      enabled: entry.enabled !== false,
      batchId: entry.batchId || null,
      remark: entry.remark || null,
      createdAt: entry.createdAt || null,
      updatedAt: entry.updatedAt || null,
    };
  }

  private clampLimit(value: any, fallback: number) {
    return Math.max(1, Math.min(1000, Number(value) || fallback));
  }

  async getSpecialBattleConfig() {
    const config = await this.loadSpecialBattleConfig();
    return {
      success: true,
      config,
    };
  }

  async updateSpecialBattleConfig(body: any) {
    const next = this.normalizeSpecialBattleConfig(body);
    await fsp.mkdir(path.dirname(this.specialBattleConfigFile), { recursive: true });
    await fsp.writeFile(this.specialBattleConfigFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return {
      success: true,
      config: next,
    };
  }

  private async loadSpecialBattleConfig() {
    try {
      const raw = await fsp.readFile(this.specialBattleConfigFile, 'utf8');
      return this.normalizeSpecialBattleConfig(JSON.parse(raw));
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.warn('[GmService] load special battle config failed:', error);
      }
      return this.normalizeSpecialBattleConfig(null);
    }
  }

  private normalizeSpecialBattleConfig(value: any) {
    const missions = Array.isArray(value?.escortMissions) ? value.escortMissions : [];
    return {
      escortMissions: missions
        .map((mission, index) => this.normalizeEscortMission(mission, index))
        .filter(Boolean),
      updatedAt: String(value?.updatedAt || this.mongoService.nowIso()),
    };
  }

  private normalizeEscortMission(entry: any, index: number) {
    const chapterId = String(entry?.chapterId || '').trim();
    const id =
      String(entry?.id || '').trim() ||
      (chapterId ? `escort_${chapterId}` : `escort_mission_${index + 1}`);
    if (!chapterId || !id) {
      return null;
    }

    const chapterIndex = Math.max(1, Number(entry?.chapterIndex || entry?.chapterNumber || index + 1) || index + 1);
    const cartTemplate = entry?.cartTemplate && typeof entry.cartTemplate === 'object' ? entry.cartTemplate : {};
    const baseRewards = entry?.baseRewards && typeof entry.baseRewards === 'object' ? entry.baseRewards : {};
    const segments = Array.isArray(entry?.segments) ? entry.segments : [];

    return {
      id,
      type: 'escort',
      chapterId,
      chapterIndex,
      name: String(entry?.name || '资源护送战').trim() || '资源护送战',
      subtitle: String(entry?.subtitle || '').trim(),
      description: String(entry?.description || '').trim(),
      background: String(entry?.background || '').trim(),
      unlockAfterDungeonId: String(entry?.unlockAfterDungeonId || '').trim(),
      recommendedLevel: Math.max(1, Number(entry?.recommendedLevel) || 1),
      energyCost: Math.max(1, Number(entry?.energyCost) || 1),
      fixedRewardRatio: this.clampRatio(entry?.fixedRewardRatio, 0.6),
      durabilityRewardRatio: this.clampRatio(entry?.durabilityRewardRatio, 0.4),
      baseRewards: Object.fromEntries(
        Object.entries(baseRewards)
          .map(([resourceId, amount]): [string, number] => [String(resourceId || '').trim(), Math.max(0, Math.floor(Number(amount) || 0))])
          .filter(([resourceId, amount]) => resourceId && amount > 0),
      ),
      cartTemplate: {
        name: String(cartTemplate?.name || '补给车').trim() || '补给车',
        icon: String(cartTemplate?.icon || '车').trim() || '车',
        hp: Math.max(1, Number(cartTemplate?.hp) || 1),
        attack: Math.max(1, Number(cartTemplate?.attack) || 1),
        defense: Math.max(0, Number(cartTemplate?.defense) || 0),
        speed: Math.max(1, Number(cartTemplate?.speed) || 1),
        attackRange: Math.max(1, Number(cartTemplate?.attackRange) || 1),
        moveRange: Math.max(1, Number(cartTemplate?.moveRange) || 1),
      },
      segments: segments
        .map((segment, segmentIndex) => this.normalizeEscortSegment(segment, id, segmentIndex))
        .filter(Boolean),
    };
  }

  private normalizeEscortSegment(entry: any, missionId: string, index: number) {
    const segmentId =
      String(entry?.id || '').trim() || `${missionId}_segment_${index + 1}`;
    const battlefield = entry?.battlefield && typeof entry.battlefield === 'object' ? entry.battlefield : {};
    const enemySpawn = battlefield?.enemySpawn && typeof battlefield.enemySpawn === 'object' ? battlefield.enemySpawn : {};

    const normalizeCoordinateList = (list: any) =>
      (Array.isArray(list) ? list : [])
        .map((point) => {
          if (Array.isArray(point)) {
            return [Math.max(1, Number(point[0]) || 1), Math.max(1, Number(point[1]) || 1)];
          }
          if (point && typeof point === 'object') {
            return [
              Math.max(1, Number(point.row ?? point.y ?? 1) || 1),
              Math.max(1, Number(point.col ?? point.x ?? 1) || 1),
            ];
          }
          return null;
        })
        .filter(Boolean);

    const normalizeSpecialTiles = (tiles: any) =>
      (Array.isArray(tiles) ? tiles : [])
        .map((tile) => {
          const type = String(tile?.type || tile?.kind || tile?.effect || '').trim();
          const positions = normalizeCoordinateList(tile?.positions || tile?.coords || tile?.cells || tile?.points || tile?.list);
          if (!type || positions.length === 0) {
            return null;
          }
          return { type, positions };
        })
        .filter(Boolean);

    const normalizeEnemyEntries = (entries: any) =>
      (Array.isArray(entries) ? entries : [])
        .map((enemy) => {
          const id = String(enemy?.id || '').trim();
          if (!id) {
            return null;
          }
          const skillIds = (Array.isArray(enemy?.skillIds) ? enemy.skillIds : [])
            .map((skillId: any) => String(skillId || '').trim())
            .filter(Boolean);
          const statsSource = enemy?.stats && typeof enemy.stats === 'object' ? enemy.stats : {};
          const overrideStatsSource = enemy?.overrideStats && typeof enemy.overrideStats === 'object' ? enemy.overrideStats : {};
          const numericObject = (source: Record<string, any>) =>
            Object.fromEntries(
              Object.entries(source)
                .map(([key, raw]) => [key, Number(raw)])
                .filter(([, raw]) => Number.isFinite(raw as number)),
            );

          const next: Record<string, any> = {
            id,
            rank: String(enemy?.rank || 'normal').trim() || 'normal',
            count: Math.max(1, Number(enemy?.count) || 1),
            positions: normalizeCoordinateList(enemy?.positions || enemy?.spawnPositions),
          };
          if (enemy?.duty !== undefined || enemy?.sourceType !== undefined) {
            next.duty = String(enemy?.duty || enemy?.sourceType || 'escort_cart').trim() || 'escort_cart';
          }
          if (enemy?.multiplier !== undefined && enemy?.multiplier !== '') {
            next.multiplier = Math.max(0.1, Number(enemy.multiplier) || 1);
          }
          if (skillIds.length) {
            next.skillIds = skillIds;
          }
          const stats = numericObject(statsSource);
          const overrideStats = numericObject(overrideStatsSource);
          if (Object.keys(stats).length > 0) {
            next.stats = stats;
          }
          if (Object.keys(overrideStats).length > 0) {
            next.overrideStats = overrideStats;
          }
          return next;
        })
        .filter(Boolean);

    return {
      id: segmentId,
      index: Math.max(1, Number(entry?.index) || index + 1),
      sourceDungeonId: String(entry?.sourceDungeonId || '').trim(),
      name: String(entry?.name || `第${index + 1}段`).trim() || `第${index + 1}段`,
      description: String(entry?.description || '').trim(),
      battlefield: {
        cols: Math.max(1, Number(battlefield?.cols || battlefield?.width || 7) || 7),
        rows: Math.max(1, Number(battlefield?.rows || battlefield?.height || 10) || 10),
        actionTimeout: Math.max(1, Number(battlefield?.actionTimeout || 25) || 25),
        heroSpawn: {
          positions: normalizeCoordinateList(battlefield?.heroSpawn?.positions),
        },
        enemySpawn: {
          positions: normalizeCoordinateList(enemySpawn?.positions),
          startRow: enemySpawn?.startRow !== undefined ? Number(enemySpawn.startRow) : undefined,
          direction: enemySpawn?.direction !== undefined ? Number(enemySpawn.direction) : undefined,
        },
        obstacles: normalizeCoordinateList(battlefield?.obstacles),
        specialTiles: normalizeSpecialTiles(battlefield?.specialTiles),
      },
      route: normalizeCoordinateList(entry?.route),
      goalPosition: (() => {
        const list = normalizeCoordinateList(entry?.goalPosition ? [entry.goalPosition] : []);
        return list[0] || null;
      })(),
      environmentEffect: String(entry?.environmentEffect || '').trim(),
      storyDialogues: Array.isArray(entry?.storyDialogues) ? entry.storyDialogues : [],
      initialEnemies: normalizeEnemyEntries(entry?.initialEnemies),
      reinforcementEnemies: normalizeEnemyEntries(entry?.reinforcementEnemies),
      bossWaves: (Array.isArray(entry?.bossWaves) ? entry.bossWaves : [])
        .map((wave, waveIndex) => ({
          id: String(wave?.id || `${segmentId}_boss_wave_${waveIndex + 1}`).trim(),
          spawnRound: Math.max(1, Number(wave?.spawnRound) || 12),
          spawnOnClearBeforeRound: wave?.spawnOnClearBeforeRound !== false,
          bosses: normalizeEnemyEntries(wave?.bosses),
        }))
        .filter((wave) => Array.isArray(wave.bosses) && wave.bosses.length > 0),
    };
  }

  private clampRatio(value: any, fallback: number) {
    const next = Number(value);
    if (!Number.isFinite(next)) {
      return fallback;
    }
    return Math.max(0, Math.min(1, next));
  }
}
