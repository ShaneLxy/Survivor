import { Injectable, BadRequestException } from '@nestjs/common';
import {
  CdkeyDocument,
  MailAttachment,
} from '../../shared/cloudbase/cloudbase.types';
import { CloudbaseService } from '../../shared/cloudbase/cloudbase.service';

@Injectable()
export class CdkeyService {
  constructor(private readonly cloudbaseService: CloudbaseService) {}

  async redeem(accountId: string, rawCode: string) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('请输入兑换码');
    }

    const collection = this.cloudbaseService.cdkeys();
    const entity = (await this.cloudbaseService.findOne(collection, { code })) as CdkeyDocument | null;
    if (!entity) {
      return { success: false, message: '兑换码不存在', rewards: [] };
    }
    if (entity.used) {
      return { success: false, message: '兑换码已被使用', rewards: [] };
    }
    if (this.isExpired(entity.expireAt)) {
      return { success: false, message: '兑换码已过期', rewards: [] };
    }

    const now = this.cloudbaseService.nowIso();
    await this.cloudbaseService.updateById(collection, entity._id, {
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
        type: (entry?.type === 'resource' ? 'resource' : 'item') as 'resource' | 'item',
        id: String(entry?.id || ''),
        amount: Math.max(0, Number(entry?.amount) || 0),
      }))
      .filter((entry) => entry.id && entry.amount > 0);
  }
}
