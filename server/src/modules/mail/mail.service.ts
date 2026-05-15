import { Injectable, NotFoundException } from '@nestjs/common';
import { MongoService } from '../../shared/mongo/mongo.service';
import {
  MailAttachment,
  PlayerMailDocument,
} from '../../shared/mongo/mongo.types';

@Injectable()
export class MailService {
  constructor(private readonly mongoService: MongoService) {}

  async listMails(accountId: string) {
    const collection = this.mongoService.playerMails();
    const mails = (await this.mongoService.findMany(collection, {
      accountId,
    })) as PlayerMailDocument[];

    return {
      success: true,
      mails: mails.map((mail) => this.serializeMail(mail)),
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

  async claimAll(accountId: string) {
    const collection = this.mongoService.playerMails();
    const mails = (await this.mongoService.findMany(collection, {
      accountId,
    })) as PlayerMailDocument[];

    const claimableMails = mails.filter((mail) => !mail.claimedAt && !this.isExpired(mail.expireAt));
    if (claimableMails.length === 0) {
      return {
        success: false,
        message: '当前没有可一键领取的邮件',
        claimedCount: 0,
        rewards: [],
        mails: mails.map((mail) => this.serializeMail(mail)),
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

    return {
      success: true,
      message: `已领取 ${claimableMails.length} 封邮件附件`,
      claimedCount: claimableMails.length,
      rewards: [...rewardMap.values()],
      mails: mails.map((mail) => this.serializeMail(mail)),
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
