import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../../shared/mongo/mongo.service';
import {
  AuditLogDocument,
  UserAccountBanStatus,
} from '../../shared/mongo/mongo.types';

/**
 * 关键字段单次 PUT 涨幅阈值。超过阈值即视为"极端异常"，直接封号。
 * 阈值故意定得偏宽——意图只挡明显作弊，正常玩家几乎不可能误触。
 * 后续观察 auditlogs 数据再决定要不要收紧。
 */
export interface SaveFieldThreshold {
  field: string;
  /** 中文描述，写日志时用 */
  label: string;
  /** 单次 PUT 允许的最大涨幅（超过即视为作弊） */
  maxDelta: number;
  /** 简单字段读取器（只读一个 number） */
  read?: (state: any) => number;
  /**
   * 高级模式：自定义评估器。返回 null 表示通过，返回 finding 表示触发异常。
   * 适用于"单个英雄等级跳变"这种需要遍历比较的场景。
   */
  evaluate?: (before: any, after: any, rule: SaveFieldThreshold) => AuditFinding | null;
}

const NUMBER = (value: any): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const SAVE_FIELD_THRESHOLDS: SaveFieldThreshold[] = [
  // —— 玩家级资源 ——
  {
    field: 'shelterData.resources.gold',
    label: '金币',
    read: (s) => NUMBER(s?.shelterData?.resources?.gold),
    maxDelta: 10_000,
  },
  {
    field: 'shelterData.resources.diamond',
    label: '钻石',
    read: (s) => NUMBER(s?.shelterData?.resources?.diamond),
    maxDelta: 5_000,
  },
];

export interface AuditFinding {
  field: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  threshold: number;
}

export interface AuditContext {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(private readonly mongoService: MongoService) {}

  /**
   * 计算关键字段的 before/after diff，返回超阈值的字段列表。
   * 支持两种模式：
   *  - 简单：rule.read 返回 number，比对 delta
   *  - 高级：rule.evaluate 自定义判断（用于"单英雄等级跳变"等需遍历比较的场景）
   */
  evaluateSaveDiff(before: any, after: any): AuditFinding[] {
    const findings: AuditFinding[] = [];
    SAVE_FIELD_THRESHOLDS.forEach((rule) => {
      if (typeof rule.evaluate === 'function') {
        const finding = rule.evaluate(before, after, rule);
        if (finding) {
          findings.push(finding);
        }
        return;
      }
      if (typeof rule.read === 'function') {
        const beforeValue = rule.read(before);
        const afterValue = rule.read(after);
        const delta = afterValue - beforeValue;
        if (delta > rule.maxDelta) {
          findings.push({
            field: rule.field,
            label: rule.label,
            before: beforeValue,
            after: afterValue,
            delta,
            threshold: rule.maxDelta,
          });
        }
      }
    });
    return findings;
  }

  /**
   * 主入口：分析 diff，写日志，如有极端异常则封号。
   * 返回是否触发封号。
   */
  async auditSaveDiff(
    accountId: string,
    before: any,
    after: any,
    ctx: AuditContext = {},
  ): Promise<{ banned: boolean; findings: AuditFinding[] }> {
    const findings = this.evaluateSaveDiff(before, after);
    if (findings.length === 0) {
      return { banned: false, findings: [] };
    }

    // 任一关键字段超阈值 → 极端异常，直接封号
    const reason = findings
      .map((f) => `${f.label}单次涨 ${f.delta}（阈值 ${f.threshold}）`)
      .join('；');

    await this.writeLog({
      accountId,
      type: 'save_banned',
      severity: 'critical',
      message: `存档异常自动封禁：${reason}`,
      details: { findings },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    await this.banAccount(accountId, reason, { findings });

    this.logger.warn(
      `[AuditService] account ${accountId} banned for save anomaly: ${reason}`,
    );

    return { banned: true, findings };
  }

  /**
   * 写一条普通审计日志（不涉及封号），调用方决定何时使用。
   * createdAt 必须是 Date 对象（不是字符串），MongoDB 的 TTL 索引才能识别。
   */
  async writeLog(entry: Omit<AuditLogDocument, '_id' | 'createdAt'> & {
    createdAt?: Date;
  }) {
    try {
      await this.mongoService.auditLogs().insertOne({
        ...entry,
        createdAt: entry.createdAt || new Date(),
      });
    } catch (error: any) {
      this.logger.error(
        `[AuditService] failed to write audit log: ${error?.message || error}`,
      );
    }
  }

  /**
   * 标记账号封禁。封号通过 useraccounts.banStatus 字段实现，登录与守卫负责拦截。
   */
  async banAccount(
    accountId: string,
    reason: string,
    details?: Record<string, any> | null,
  ) {
    const banStatus: UserAccountBanStatus = {
      bannedAt: this.mongoService.nowIso(),
      reason,
      details: details || null,
    };
    try {
      await this.mongoService.updateById(
        this.mongoService.userAccounts() as any,
        accountId,
        { banStatus, updatedAt: this.mongoService.nowIso() } as any,
      );
    } catch (error: any) {
      this.logger.error(
        `[AuditService] failed to set banStatus on ${accountId}: ${error?.message || error}`,
      );
    }
  }

  /**
   * 工具方法：从 Express request 提取审计上下文。
   */
  static extractContext(req: any): AuditContext {
    if (!req) {
      return {};
    }
    const ip =
      String(
        req.headers?.['x-forwarded-for'] ||
          req.ip ||
          req.socket?.remoteAddress ||
          '',
      )
        .split(',')[0]
        .trim() || null;
    const userAgent = String(req.headers?.['user-agent'] || '') || null;
    return { ip, userAgent };
  }
}
