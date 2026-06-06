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

/**
 * 通用工具：在英雄数组里按 id 找匹配，比对某个数值字段的最大跳变。
 */
function maxHeroNumericDelta(
  before: any,
  after: any,
  field: 'level' | 'exp',
): { delta: number; heroId: string | null; beforeValue: number; afterValue: number } {
  const beforeHeroes: any[] = Array.isArray(before?.heroData?.heroes) ? before.heroData.heroes : [];
  const afterHeroes: any[] = Array.isArray(after?.heroData?.heroes) ? after.heroData.heroes : [];
  const beforeMap = new Map<string, any>();
  beforeHeroes.forEach((h) => {
    const id = String(h?.id || '').trim();
    if (id) beforeMap.set(id, h);
  });
  let bestDelta = 0;
  let bestHeroId: string | null = null;
  let bestBefore = 0;
  let bestAfter = 0;
  afterHeroes.forEach((h) => {
    const id = String(h?.id || '').trim();
    if (!id) return;
    const beforeHero = beforeMap.get(id);
    // 新加入的英雄（before 没有）跳过，让 heroes.length 这条规则去管数量
    if (!beforeHero) return;
    const beforeValue = NUMBER(beforeHero?.[field]);
    const afterValue = NUMBER(h?.[field]);
    const delta = afterValue - beforeValue;
    if (delta > bestDelta) {
      bestDelta = delta;
      bestHeroId = id;
      bestBefore = beforeValue;
      bestAfter = afterValue;
    }
  });
  return { delta: bestDelta, heroId: bestHeroId, beforeValue: bestBefore, afterValue: bestAfter };
}

/**
 * 通用工具：碎片表（按 configId 索引），比对最大跳变。
 */
function maxFragmentDelta(
  before: any,
  after: any,
): { delta: number; configId: string | null; beforeValue: number; afterValue: number } {
  const beforeFrags: Record<string, any> = before?.heroData?.fragments || {};
  const afterFrags: Record<string, any> = after?.heroData?.fragments || {};
  let bestDelta = 0;
  let bestKey: string | null = null;
  let bestBefore = 0;
  let bestAfter = 0;
  Object.keys(afterFrags).forEach((key) => {
    const beforeValue = NUMBER(beforeFrags[key]);
    const afterValue = NUMBER(afterFrags[key]);
    const delta = afterValue - beforeValue;
    if (delta > bestDelta) {
      bestDelta = delta;
      bestKey = key;
      bestBefore = beforeValue;
      bestAfter = afterValue;
    }
  });
  return { delta: bestDelta, configId: bestKey, beforeValue: bestBefore, afterValue: bestAfter };
}

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
  {
    field: 'shelterData.resources.wood',
    label: '木材',
    read: (s) => NUMBER(s?.shelterData?.resources?.wood),
    maxDelta: 5_000,
  },
  {
    field: 'shelterData.resources.stone',
    label: '石头',
    read: (s) => NUMBER(s?.shelterData?.resources?.stone),
    maxDelta: 5_000,
  },
  {
    field: 'shelterData.resources.meat',
    label: '肉',
    read: (s) => NUMBER(s?.shelterData?.resources?.meat),
    maxDelta: 1_000,
  },
  {
    field: 'shelterData.resources.iron_ore',
    label: '铁矿',
    read: (s) => NUMBER(s?.shelterData?.resources?.iron_ore),
    maxDelta: 2_000,
  },
  // —— 玩家进度 ——
  {
    field: 'player.exp',
    label: '玩家经验',
    read: (s) => NUMBER(s?.player?.exp),
    maxDelta: 200,
  },
  {
    field: 'player.level',
    label: '玩家等级',
    read: (s) => NUMBER(s?.player?.level),
    maxDelta: 1,
  },
  // —— 英雄系统 ——
  {
    field: 'heroData.heroes.length',
    label: '英雄数量',
    read: (s) => (Array.isArray(s?.heroData?.heroes) ? s.heroData.heroes.length : 0),
    // 考虑抽卡 burst：新号狂抽十连重复率低时可能短时间增加大量英雄
    // 抽卡服务端化（Phase 1）后可收紧到 30
    maxDelta: 100,
  },
  {
    field: 'heroData.heroes[].level',
    label: '单个英雄等级跳变',
    maxDelta: 3,
    evaluate: (before, after, rule) => {
      const r = maxHeroNumericDelta(before, after, 'level');
      if (r.delta > rule.maxDelta) {
        return {
          field: `${rule.field}#${r.heroId}`,
          label: `${rule.label}（heroId=${r.heroId}）`,
          before: r.beforeValue,
          after: r.afterValue,
          delta: r.delta,
          threshold: rule.maxDelta,
        };
      }
      return null;
    },
  },
  {
    field: 'heroData.fragments[*]',
    label: '单个英雄碎片跳变',
    // 考虑抽卡 burst：大量重复抽到同一英雄时单英雄碎片可能猛涨
    // 抽卡服务端化（Phase 1）后可收紧到 500
    maxDelta: 2000,
    evaluate: (before, after, rule) => {
      const r = maxFragmentDelta(before, after);
      if (r.delta > rule.maxDelta) {
        return {
          field: `${rule.field}#${r.configId}`,
          label: `${rule.label}（configId=${r.configId}）`,
          before: r.beforeValue,
          after: r.afterValue,
          delta: r.delta,
          threshold: rule.maxDelta,
        };
      }
      return null;
    },
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
