import { BadRequestException, Injectable } from '@nestjs/common';
import { MongoService } from '../../shared/mongo/mongo.service';
import {
  CdkeyDocument,
  MailAttachment,
  PlayerMailDocument,
  UserAccountDocument,
} from '../../shared/mongo/mongo.types';

@Injectable()
export class GmService {
  constructor(private readonly mongoService: MongoService) {}

  async listPlayers(query: any = {}) {
    const keyword = String(query.keyword || '').trim();
    const limit = this.clampLimit(query.limit, 100);
    const where = keyword
      ? {
          $or: [
            { account: { $regex: keyword, $options: 'i' } },
            { nickname: { $regex: keyword, $options: 'i' } },
          ],
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
      players: players.map((player: any) => ({
        id: String(player._id),
        account: player.account || '',
        nickname: player.nickname || '',
        loginType: player.loginType || '',
        lastLoginAt: player.lastLoginAt || null,
        createdAt: player.createdAt || null,
        updatedAt: player.updatedAt || null,
      })),
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
}
