import { Injectable, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { MongoService } from '../../shared/mongo/mongo.service';
import {
  MailAttachment,
  PlayerMailDocument,
} from '../../shared/mongo/mongo.types';

export interface ListMailsOptions {
  /**
   * 限制 "已领取" 和 "已过期" 两类各返回最近多少封(按 createdAt 倒序)。
   * "待领取" 不受此限制,始终返回全量,以保证红点 / 一键领取的准确性。
   * 不传或非正整数则不做截断(向下兼容旧客户端)。
   */
  recent?: number;
}

export interface ListMailsMeta {
  claimableCount: number;
  claimedTotal: number;
  claimedShown: number;
  expiredTotal: number;
  expiredShown: number;
}

@Injectable()
export class MailService {
  constructor(private readonly mongoService: MongoService) {}

  async listMails(accountId: string, options: ListMailsOptions = {}) {
    const collection = this.mongoService.playerMails();
    const recent = this.normalizeRecent(options.recent);
    const nowIso = this.mongoService.nowIso();

    // 1) 待领取:claimedAt 为空 且 expireAt 为空或未到期 → 全量
    const claimableFilter = {
      accountId,
      claimedAt: null,
      $or: [{ expireAt: null }, { expireAt: { $gt: nowIso } }],
    } as any;

    // 2) 已领取:claimedAt 非空(即便后来过期,只要领过就归这类)
    const claimedFilter = {
      accountId,
      claimedAt: { $ne: null },
    } as any;

    // 3) 已过期:claimedAt 为空 且 expireAt <= now
    const expiredFilter = {
      accountId,
      claimedAt: null,
      expireAt: { $ne: null, $lte: nowIso },
    } as any;

    // 并行查询,降低响应延迟
    const [
      claimableRaw,
      claimedRaw,
      claimedTotal,
      expiredRaw,
      expiredTotal,
    ] = await Promise.all([
      collection.find(claimableFilter).sort({ createdAt: -1 }).toArray(),
      recent === null
        ? collection.find(claimedFilter).sort({ createdAt: -1 }).toArray()
        : collection.find(claimedFilter).sort({ createdAt: -1 }).limit(recent).toArray(),
      collection.countDocuments(claimedFilter),
      recent === null
        ? collection.find(expiredFilter).sort({ createdAt: -1 }).toArray()
        : collection.find(expiredFilter).sort({ createdAt: -1 }).limit(recent).toArray(),
      collection.countDocuments(expiredFilter),
    ]);

    const claimable = claimableRaw.map((doc) => this.serializeMail(this.toMailDocument(doc)));
    const claimed = claimedRaw.map((doc) => this.serializeMail(this.toMailDocument(doc)));
    const expired = expiredRaw.map((doc) => this.serializeMail(this.toMailDocument(doc)));

    const meta: ListMailsMeta = {
      claimableCount: claimable.length,
      claimedTotal,
      claimedShown: claimed.length,
      expiredTotal,
      expiredShown: expired.length,
    };

    return {
      success: true,
      // 客户端拿到后会按它自己的规则再排序,这里只是把三类拼起来,
      // 保留 待领取 > 已领取 > 已过期 的视觉直觉。
      mails: [...claimable, ...claimed, ...expired],
      meta,
    };
  }

  async markRead(accountId: string, mailId: string) {
    const mail = await this.requireMail(accountId, mailId);
    if (!mail.readAt) {
      const now = this.mongoService.nowIso();
      await this.mongoService.updateById(this.mongoService.playerMails(), mail._id, {
        readAt: now,
        updatedAt: now,
      });
      mail.readAt = now;
      mail.updatedAt = now;
    }

    return {
      success: true,
      mail: this.serializeMail(mail),
    };
  }

  async claim(accountId: string, mailId: string) {
    const mail = await this.requireMail(accountId, mailId);
    if (mail.claimedAt) {
      return {
        success: false,
        message: '该邮件附件已领取',
        mail: this.serializeMail(mail),
        rewards: [],
      };
    }

    if (this.isExpired(mail.expireAt)) {
      return {
        success: false,
        message: '邮件已过期',
        mail: this.serializeMail(mail),
        rewards: [],
      };
    }

    const now = this.mongoService.nowIso();
    await this.mongoService.updateById(this.mongoService.playerMails(), mail._id, {
      claimedAt: now,
      readAt: mail.readAt || now,
      updatedAt: now,
    });

    mail.claimedAt = now;
    mail.readAt = mail.readAt || now;
    mail.updatedAt = now;

    return {
      success: true,
      message: '附件领取成功',
      mail: this.serializeMail(mail),
      rewards: this.normalizeAttachments(mail.attachments),
    };
  }

  async claimAll(accountId: string, options: ListMailsOptions = {}) {
    const collection = this.mongoService.playerMails();
    const mails = (await this.mongoService.findMany(collection, {
      accountId,
    })) as PlayerMailDocument[];

    const claimableMails = mails.filter((mail) => !mail.claimedAt && !this.isExpired(mail.expireAt));
    if (claimableMails.length === 0) {
      // 复用 listMails 的截断口径,确保即便没有可领的邮件,响应大小也受控
      const listResult = await this.listMails(accountId, options);
      return {
        success: false,
        message: '当前没有可一键领取的邮件',
        claimedCount: 0,
        rewards: [],
        mails: listResult.mails,
        meta: listResult.meta,
      };
    }

    const rewardMap = new Map<string, MailAttachment>();
    const now = this.mongoService.nowIso();

    for (const mail of claimableMails) {
      await this.mongoService.updateById(collection, mail._id, {
        claimedAt: now,
        readAt: mail.readAt || now,
        updatedAt: now,
      });

      mail.claimedAt = now;
      mail.readAt = mail.readAt || now;
      mail.updatedAt = now;

      this.normalizeAttachments(mail.attachments).forEach((attachment) => {
        const key = `${attachment.type}:${attachment.id}`;
        const existing: MailAttachment = rewardMap.get(key) || {
          type: attachment.type,
          id: attachment.id,
          amount: 0,
        };
        existing.amount += Number(attachment.amount) || 0;
        rewardMap.set(key, existing);
      });
    }

    // 领取完成后,用 listMails 的截断口径重新拼装一次,保证 mails 数组
    // 不会包含玩家从未关心的几百封历史邮件。客户端拿到后会 setMails 覆盖。
    const listResult = await this.listMails(accountId, options);

    return {
      success: true,
      message: `已领取 ${claimableMails.length} 封邮件附件`,
      claimedCount: claimableMails.length,
      rewards: [...rewardMap.values()],
      mails: listResult.mails,
      meta: listResult.meta,
    };
  }

  private async requireMail(accountId: string, mailId: string) {
    const collection = this.mongoService.playerMails();
    const mail = (await this.mongoService.getById(collection, mailId)) as PlayerMailDocument | null;
    if (!mail || mail.accountId !== accountId) {
      throw new NotFoundException('Mail not found');
    }
    return mail;
  }

  private isExpired(expireAt: string | number | null | undefined) {
    if (!expireAt) {
      return false;
    }
    return Date.parse(String(expireAt)) <= Date.now();
  }

  private normalizeAttachments(attachments: MailAttachment[] | null | undefined): MailAttachment[] {
    return (Array.isArray(attachments) ? attachments : [])
      .map((entry) => ({
        type: this.normalizeRewardType(entry?.type),
        id: String(entry?.id || ''),
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

  /**
   * 把可选的 recent query 规整成 number | null。null 表示不截断(向下兼容)。
   * 上限 100 防止恶意大 limit 拖累 DB。
   */
  private normalizeRecent(recent: number | undefined | null): number | null {
    if (recent === undefined || recent === null) return null;
    const n = Math.floor(Number(recent));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(n, 100);
  }

  /**
   * 把从 collection.find().toArray() 拿到的原始文档转换成 PlayerMailDocument:
   * 主要是把 ObjectId 序列化为 hex 字符串(对齐 mongoService.serializeDocument)。
   */
  private toMailDocument(doc: any): PlayerMailDocument {
    return {
      ...doc,
      _id: doc?._id instanceof ObjectId
        ? doc._id.toHexString()
        : String(doc?._id || ''),
    } as PlayerMailDocument;
  }

  private serializeMail(mail: PlayerMailDocument) {
    return {
      id: mail._id,
      title: mail.title || '未命名邮件',
      body: mail.body || '',
      sender: mail.sender || '系统',
      accountId: mail.accountId,
      createdAt: mail.createdAt,
      expireAt: mail.expireAt,
      readAt: mail.readAt || null,
      claimedAt: mail.claimedAt || null,
      attachments: this.normalizeAttachments(mail.attachments),
    };
  }
}
