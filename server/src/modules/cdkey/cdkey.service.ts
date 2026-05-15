import { BadRequestException, Injectable } from '@nestjs/common';
import { MongoService } from '../../shared/mongo/mongo.service';
import { CdkeyDocument, MailAttachment } from '../../shared/mongo/mongo.types';

@Injectable()
export class CdkeyService {
  constructor(private readonly mongoService: MongoService) {}

  async redeem(accountId: string, rawCode: string) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('请输入兑换码');
    }

    const collection = this.mongoService.cdkeys();
    const entity = (await this.mongoService.findOne(collection, { code })) as CdkeyDocument | null;
    if (!entity) {
      return { success: false, message: '兑换码不存在', rewards: [] };
    }
    if (entity.used) {
      return { success: false, message: '兑换码已被使用', rewards: [] };
    }
    if (entity.enabled === false) {
      return { success: false, message: '兑换码已停用', rewards: [] };
    }
    if (this.isExpired(entity.expireAt)) {
      return { success: false, message: '兑换码已过期', rewards: [] };
    }

    const now = this.mongoService.nowIso();
    await this.mongoService.updateById(collection, entity._id, {
      used: true,
      usedByAccountId: accountId,
      usedAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      message: '兑换成功',
      rewards: this.normalizeRewards(entity.rewards),
      cdkey: {
        id: entity._id,
        code: entity.code,
        title: entity.title || null,
      },
    };
  }

  private isExpired(expireAt: string | null | undefined) {
    if (!expireAt) {
      return false;
    }
    return Date.parse(String(expireAt)) <= Date.now();
  }

  private normalizeRewards(rewards: MailAttachment[] | null | undefined): MailAttachment[] {
    return (Array.isArray(rewards) ? rewards : [])
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
}
