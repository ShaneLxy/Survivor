const fs = require('fs');
const path = require('path');
const catalogPath = path.join('E:/AIGame/Survivor/data/unit-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

catalog.professions = {
  defender: {
    id: 'defender',
    name: '守备者',
    description: '突出高生命与高防御的前排职业，速度偏慢，擅长为队伍提供承伤与增益支援。',
    tags: ['frontline', 'buff', 'durable']
  },
  psionic: {
    id: 'psionic',
    name: '灵能者',
    description: '高速但偏脆的技巧型职业，擅长控制、辅助与战场节奏干扰。',
    tags: ['control', 'buff', 'fast']
  },
  raider: {
    id: 'raider',
    name: '破袭者',
    description: '高攻击与高暴击倾向的输出职业，负责快速突破与定点斩杀。',
    tags: ['damage', 'burst', 'crit']
  }
};

const hero = (id, name, icon, portrait, rarity, profession, baseStats, skill) => ({
  id,
  name,
  icon,
  portrait,
  rarity,
  profession,
  attackCoefficient: 1,
  baseStats,
  skill,
  skills: [skill]
});

catalog.heroes = [
  hero('hero_007', '霜耳骇客-凛', '🔮', 'assets/media/heroes/Lynn.png', 'epic', 'psionic', { hp: 112, attack: 34, defense: 8, speed: 33, crit: 10, antiCrit: 5, defensePen: 4, accuracy: 12, dodge: 11, attackRange: 3, moveRange: 4 }, { name: '冰链入侵', description: '冻结数据流后引爆脉冲，造成125%攻击伤害。', multiplier: 1.25 }),
  hero('hero_008', '荒野白隼-柯尔特', '🗡️', 'assets/media/heroes/Colt.png', 'epic', 'raider', { hp: 126, attack: 43, defense: 10, speed: 28, crit: 14, antiCrit: 5, defensePen: 8, accuracy: 11, dodge: 7, attackRange: 3, moveRange: 3 }, { name: '白隼点杀', description: '锁定要害发起速射，造成145%攻击伤害。', multiplier: 1.45 }),
  hero('hero_009', '霜牙壁垒-哈维', '🛡️', 'assets/media/heroes/Heavy.png', 'epic', 'defender', { hp: 220, attack: 24, defense: 22, speed: 15, crit: 6, antiCrit: 10, defensePen: 2, accuracy: 6, dodge: 2, attackRange: 1, moveRange: 2 }, { name: '冻牙壁垒', description: '以重盾撼击前方目标，造成120%攻击伤害。', multiplier: 1.2 }),
  hero('hero_010', '赤核浪客-夜刃', '🗡️', 'assets/media/heroes/Yajin.jpg', 'epic', 'raider', { hp: 118, attack: 46, defense: 9, speed: 31, crit: 15, antiCrit: 5, defensePen: 9, accuracy: 12, dodge: 8, attackRange: 1, moveRange: 4 }, { name: '赤核斩流', description: '借助赤核能量突进斩杀，造成155%攻击伤害。', multiplier: 1.55 }),
  hero('hero_011', '黑羽枪影-星弦', '🗡️', 'assets/media/heroes/Galaxy.png', 'rare', 'raider', { hp: 104, attack: 36, defense: 8, speed: 29, crit: 12, antiCrit: 4, defensePen: 6, accuracy: 10, dodge: 7, attackRange: 3, moveRange: 3 }, { name: '黑羽穿刺', description: '枪影贯穿敌阵，造成125%攻击伤害。', multiplier: 1.25 }),
  hero('hero_012', '灰影哨戒-格雷', '🛡️', 'assets/media/heroes/Gray.png', 'rare', 'defender', { hp: 188, attack: 23, defense: 19, speed: 17, crit: 6, antiCrit: 9, defensePen: 2, accuracy: 7, dodge: 3, attackRange: 1, moveRange: 2 }, { name: '灰影警戒', description: '稳步压前并强硬反击，造成118%攻击伤害。', multiplier: 1.18 }),
  hero('hero_013', '魔导智刃-艾莉丝', '🔮', 'assets/media/heroes/Elise.jpg', 'epic', 'psionic', { hp: 108, attack: 38, defense: 7, speed: 32, crit: 10, antiCrit: 5, defensePen: 4, accuracy: 11, dodge: 9, attackRange: 3, moveRange: 4 }, { name: '魔导裂刃', description: '操纵智刃切开灵能回路，造成138%攻击伤害。', multiplier: 1.38 }),
  hero('hero_014', '破界脉冲-紫狐', '🗡️', 'assets/media/heroes/PurpleFox.png', 'legendary', 'raider', { hp: 132, attack: 52, defense: 10, speed: 34, crit: 18, antiCrit: 6, defensePen: 10, accuracy: 13, dodge: 10, attackRange: 2, moveRange: 4 }, { name: '破界脉冲', description: '撕开界面后引爆脉冲，造成180%攻击伤害。', multiplier: 1.8 }),
  hero('hero_015', '赤瞳双刃-星野', '🔮', 'assets/media/heroes/Hoshino.png', 'epic', 'psionic', { hp: 114, attack: 36, defense: 8, speed: 35, crit: 11, antiCrit: 5, defensePen: 4, accuracy: 13, dodge: 12, attackRange: 2, moveRange: 4 }, { name: '赤瞳双闪', description: '以双刃切入灵能盲区，造成142%攻击伤害。', multiplier: 1.42 }),
  hero('hero_016', '玉铃雪姬-铃月', '🗡️', 'assets/media/heroes/LingYue.png', 'epic', 'raider', { hp: 120, attack: 44, defense: 9, speed: 30, crit: 15, antiCrit: 5, defensePen: 8, accuracy: 11, dodge: 8, attackRange: 2, moveRange: 4 }, { name: '玉铃残月', description: '伴随铃响连斩敌阵，造成150%攻击伤害。', multiplier: 1.5 }),
  hero('hero_017', '堕罪弥撒-薇拉', '🔮', 'assets/media/heroes/Vera.png', 'epic', 'psionic', { hp: 110, attack: 37, defense: 8, speed: 34, crit: 10, antiCrit: 6, defensePen: 4, accuracy: 12, dodge: 10, attackRange: 3, moveRange: 4 }, { name: '堕罪弥撒', description: '吟唱禁忌颂词压制目标，造成140%攻击伤害。', multiplier: 1.4 }),
  hero('hero_018', '猎罪惩者-金', '🔮', 'assets/media/heroes/King.png', 'rare', 'psionic', { hp: 96, attack: 31, defense: 7, speed: 30, crit: 9, antiCrit: 4, defensePen: 3, accuracy: 10, dodge: 8, attackRange: 3, moveRange: 4 }, { name: '猎罪裁决', description: '锁定罪痕发动制裁，造成122%攻击伤害。', multiplier: 1.22 }),
  hero('hero_019', '赤链匠师-发条', '🛡️', 'assets/media/heroes/Clockwork.png', 'rare', 'defender', { hp: 198, attack: 22, defense: 20, speed: 16, crit: 6, antiCrit: 9, defensePen: 2, accuracy: 7, dodge: 3, attackRange: 1, moveRange: 2 }, { name: '赤链重构', description: '挥舞链刃稳定压制前线，造成116%攻击伤害。', multiplier: 1.16 })
];

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log('saved', catalog.heroes.length);
