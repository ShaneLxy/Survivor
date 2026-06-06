/**
 * 昵称黑名单过滤器
 * 包含不文明词汇、违法词汇、敏感词汇
 */

// 黑名单词库（示例，实际使用时需要扩充）
const BLACKLIST_WORDS = [
  // 政治敏感
  '习近平', '毛泽东', '邓小平', '江泽民', '胡锦涛',
  '共产党', '国民党', '民进党', '法轮功', '达赖',
  '台独', '藏独', '疆独', '港独', '六四',
  '天安门', '反动', '颠覆', '暴乱', '游行',

  // 色情低俗
  '性交', '做爱', '强奸', '轮奸', '鸡巴',
  '阴茎', '阴道', '乳房', '屁股', '妓女',
  '嫖娼', '卖淫', '色情', '淫荡', '骚货',
  '操你', '草你', '日你', '干你', '艹你',

  // 暴力血腥
  '杀人', '自杀', '他杀', '谋杀', '屠杀',
  '砍头', '斩首', '肢解', '虐待', '酷刑',

  // 赌博诈骗
  '赌博', '赌场', '赌钱', '赌博网', '博彩',
  '六合彩', '时时彩', '彩票', '诈骗', '传销',
  '洗钱', '贩毒', '走私', '贩卖', '器官',

  // 歧视侮辱
  '傻逼', '煞笔', '沙比', '傻比', '白痴',
  '智障', '弱智', '残废', '废物', '垃圾',
  '贱人', '婊子', '妓女', '狗日', '畜生',
  '死全家', '你妈', '你爹', '你爷', '你奶',

  // 宗教极端
  '圣战', '真主', '穆罕默德', '伊斯兰国', 'ISIS',
  '基地组织', '恐怖分子', '恐怖主义', '极端主义',

  // 其他违法
  '毒品', '海洛因', '冰毒', '摇头丸', '大麻',
  '枪支', '炸药', '炸弹', '爆炸', '恐怖',
  '病毒', '木马', '外挂', '私服', '盗号',

  // 常见变体
  'fuck', 'shit', 'bitch', 'ass', 'dick',
  'pussy', 'cunt', 'nigger', 'nazi', 'hitler',

  // GM/管理员冒充
  'GM', 'gm', 'Gm', '管理员', '客服',
  '官方', '系统', 'SYSTEM', 'ADMIN', 'admin'
];

// 敏感词正则模式（用于检测变体）
const SENSITIVE_PATTERNS = [
  /[习|xi][近|jin][平|ping]/i,
  /[共|gong][产|chan][党|dang]/i,
  /[法|fa][轮|lun][功|gong]/i,
  /[六|6][四|4]/,
  /[操|cao|草|艹][你|ni|泥]/i,
  /[傻|sha][逼|比|b|bi]/i,
  /[妈|ma][的|de|逼|比]/i,
  /[赌|du][博|bo]/i,
  /[色|se][情|qing]/i
];

/**
 * 检查昵称是否包含黑名单词汇
 * @param nickname 待检查的昵称
 * @returns true表示包含违禁词，false表示通过
 */
export function containsBlacklistWord(nickname: string): boolean {
  if (!nickname || typeof nickname !== 'string') {
    return false;
  }

  const lowerNickname = nickname.toLowerCase();

  // 检查精确匹配
  for (const word of BLACKLIST_WORDS) {
    if (lowerNickname.includes(word.toLowerCase())) {
      return true;
    }
  }

  // 检查正则模式
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(nickname)) {
      return true;
    }
  }

  return false;
}

/**
 * 验证昵称是否合法
 * @param nickname 待验证的昵称
 * @returns { valid: boolean, reason?: string }
 */
export function validateNickname(nickname: string): { valid: boolean; reason?: string } {
  if (!nickname || typeof nickname !== 'string') {
    return { valid: false, reason: '昵称不能为空' };
  }

  const trimmed = nickname.trim();

  // 长度检查（1-6个字符）
  if (trimmed.length === 0) {
    return { valid: false, reason: '昵称不能为空' };
  }

  if (trimmed.length > 6) {
    return { valid: false, reason: '昵称不能超过6个字' };
  }

  // 黑名单检查
  if (containsBlacklistWord(trimmed)) {
    return { valid: false, reason: '昵称包含违禁词汇' };
  }

  // 特殊字符检查（只允许中文、英文、数字）
  const validPattern = /^[一-龥a-zA-Z0-9]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, reason: '昵称只能包含中文、英文和数字' };
  }

  return { valid: true };
}

/**
 * 过滤昵称（移除违禁词）
 * @param nickname 原始昵称
 * @returns 过滤后的昵称
 */
export function sanitizeNickname(nickname: string): string {
  if (!nickname) {
    return '';
  }

  let sanitized = nickname.trim();

  // 移除黑名单词汇
  for (const word of BLACKLIST_WORDS) {
    const regex = new RegExp(word, 'gi');
    sanitized = sanitized.replace(regex, '**');
  }

  // 限制长度
  if (sanitized.length > 6) {
    sanitized = sanitized.substring(0, 6);
  }

  return sanitized;
}
