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
  hero('hero_010', '赤核浪客-夜刃', '🗡️', 'assets/media/heroes/Yajin.jpg', 'epic', 'raider', { hp: 118, attack: 46, defense: 9, speed: 31, crit: 15, antiCrit: 5, defensePen: 9, accuracy: 12, dodge: 8, attackRange: 1, moveRange: 4 }, { name: '赤核斩流', description: '借助赤核能量突进斩杀，造成155%攻击伤害。', multiplier: 1.55 })
];

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log('saved', catalog.heroes.length);
