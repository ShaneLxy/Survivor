/**
 * 随机昵称生成器
 * 格式：[形容词1][形容词2][名词]
 * 例如：锈蚀破晓行者、暗影孤独猎手
 */

// 形容词词库（50个）
const ADJECTIVES = [
  '锈蚀', '破晓', '暗影', '钢铁', '废土',
  '孤独', '流浪', '迷失', '幽灵', '回声',
  '寒霜', '烈焰', '风暴', '雷鸣', '星陨',
  '深渊', '苍穹', '荒芜', '寂静', '狂野',
  '永恒', '虚无', '混沌', '秩序', '光辉',
  '黯淡', '凛冽', '炽热', '冰封', '灼烧',
  '坚韧', '脆弱', '迅捷', '沉重', '轻盈',
  '锋利', '钝重', '灵动', '笨拙', '精准',
  '模糊', '清晰', '遥远', '贴近', '高耸',
  '低沉', '尖锐', '柔和', '粗糙', '光滑'
];

// 名词词库（30个）
const NOUNS = [
  '行者', '猎手', '拾荒者', '游侠', '守望者',
  '幸存者', '哨兵', '斥候', '战士', '勇士',
  '刺客', '射手', '法师', '术士', '牧师',
  '骑士', '盗贼', '游民', '浪人', '侠客',
  '剑客', '枪手', '弓手', '刀客', '拳师',
  '医者', '工匠', '商人', '学者', '诗人'
];

/**
 * 生成随机昵称
 * @returns 格式为"形容词1+形容词2+名词"的昵称，长度5-6字
 */
export function generateRandomNickname(): string {
  const adj1 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  let adj2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];

  // 确保两个形容词不重复
  let attempts = 0;
  while (adj2 === adj1 && attempts < 10) {
    adj2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    attempts++;
  }

  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

  return `${adj1}${adj2}${noun}`;
}

/**
 * 批量生成多个候选昵称
 * @param count 生成数量
 * @returns 昵称数组
 */
export function generateNicknameCandidates(count: number = 5): string[] {
  const candidates = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 10;

  while (candidates.size < count && attempts < maxAttempts) {
    candidates.add(generateRandomNickname());
    attempts++;
  }

  return Array.from(candidates);
}

/**
 * 获取词库统计信息
 */
export function getNicknameStats() {
  return {
    adjectiveCount: ADJECTIVES.length,
    nounCount: NOUNS.length,
    totalCombinations: ADJECTIVES.length * (ADJECTIVES.length - 1) * NOUNS.length,
    estimatedUniqueNames: Math.floor(ADJECTIVES.length * (ADJECTIVES.length - 1) * NOUNS.length * 0.95)
  };
}
