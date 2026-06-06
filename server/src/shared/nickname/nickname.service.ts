/**
 * 昵称服务
 * 提供昵称生成、验证、唯一性检查等功能
 */

import { generateRandomNickname, getNicknameStats } from './nickname-generator';
import { validateNickname, containsBlacklistWord } from './nickname-blacklist';

export interface NicknameGenerationOptions {
  maxAttempts?: number;
  checkUniqueness?: (nickname: string) => Promise<boolean>;
}

export interface NicknameGenerationResult {
  success: boolean;
  nickname?: string;
  reason?: string;
  attempts?: number;
}

/**
 * 生成唯一且合法的昵称
 * @param options 生成选项
 * @returns 生成结果
 */
export async function generateUniqueNickname(
  options: NicknameGenerationOptions = {}
): Promise<NicknameGenerationResult> {
  const { maxAttempts = 50, checkUniqueness } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const nickname = generateRandomNickname();

    // 验证合法性
    const validation = validateNickname(nickname);
    if (!validation.valid) {
      continue;
    }

    // 检查唯一性
    if (checkUniqueness) {
      const isUnique = await checkUniqueness(nickname);
      if (!isUnique) {
        continue;
      }
    }

    return {
      success: true,
      nickname,
      attempts: attempt
    };
  }

  return {
    success: false,
    reason: `尝试${maxAttempts}次后仍未生成唯一昵称`,
    attempts: maxAttempts
  };
}

/**
 * 验证用户提交的昵称
 * @param nickname 用户提交的昵称
 * @param checkUniqueness 唯一性检查函数
 * @returns 验证结果
 */
export async function validateUserNickname(
  nickname: string,
  checkUniqueness?: (nickname: string) => Promise<boolean>
): Promise<{ valid: boolean; reason?: string }> {
  // 基础验证
  const validation = validateNickname(nickname);
  if (!validation.valid) {
    return validation;
  }

  // 唯一性检查
  if (checkUniqueness) {
    const isUnique = await checkUniqueness(nickname);
    if (!isUnique) {
      return { valid: false, reason: '昵称已被使用' };
    }
  }

  return { valid: true };
}

/**
 * 获取昵称系统统计信息
 */
export function getNicknameSystemStats() {
  return getNicknameStats();
}

// 导出其他工具函数
export { generateRandomNickname, validateNickname, containsBlacklistWord };
