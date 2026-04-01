# 末日生存 - Survivor

一款基于纯 JavaScript + HTML + CSS 开发的末日生存放置手游。

## 技术栈

- **纯 JavaScript** (ES6+)
- **HTML5**
- **CSS3** (Flexbox + Grid + CSS Animations)
- **LocalStorage** (存档)
- **无外部依赖** (Vanilla JS)

## 游戏特色

### 核心玩法

1. **避难所管理**
   - 升级建筑产出资源
   - 离线挂机计算产出
   - 资源升级建筑

2. **英雄系统**
   - 英雄招募(抽卡)
   - 英雄升级/升星
   - 编队上阵
   - 战力计算

3. **副本探索**
   - 多难度副本
   - 回合制战斗
   - 战斗速度可调(跳过/正常)
   - 星级评价系统

4. **道具系统**
   - 资源道具(木材/石材/肉类/水源)
   - 消耗品(药物/体力药水)
   - 装备(武器/防具)
   - 道具使用/出售

5. **抽卡系统**
   - 单抽/十连抽
   - 稀有度保底机制
   - 重复英雄转换金币

### UI 设计

- **上下分区布局**
  - 顶部状态栏 (5vh): 等级/体力/金币
  - 上半屏展示区 (55vh): 动态场景内容
  - 下半屏道具区 (35vh): 资源道具网格
  - 底部Tab导航 (5vh): 功能切换

- **响应式设计**
  - 使用 vh/vw 视口单位
  - 支持移动端适配
  - 暗色末日风格

## 快速开始

### 1. 安装依赖

无需安装,直接打开即可运行!

### 2. 启动本地服务器

```bash
# 方式1: 使用Python
python -m http.server 8080

# 方式2: 使用Node.js (需要安装http-server)
npx http-server -p 8080

# 方式3: 使用PHP
php -S localhost:8080
```

### 3. 访问游戏

在浏览器中打开: `http://localhost:8080`

## 项目结构

```
Survivor/
├── index.html              # 入口页面
├── package.json            # 项目配置
├── README.md              # 项目文档
├── css/                   # 样式文件
│   ├── reset.css          # 重置样式
│   ├── common.css        # 通用样式
│   ├── components.css    # 组件样式
│   └── views.css         # 视图样式
├── js/                    # JavaScript代码
│   ├── main.js           # 游戏入口
│   ├── core/             # 核心框架
│   │   ├── EventManager.js
│   │   ├── SaveManager.js
│   │   ├── AudioManager.js
│   │   └── Utils.js
│   ├── config/           # 配置表
│   │   ├── GameConfig.js
│   │   ├── HeroConfig.js
│   │   ├── DungeonConfig.js
│   │   ├── BuildingConfig.js
│   │   ├── ItemConfig.js
│   │   └── GachaConfig.js
│   ├── managers/         # 游戏管理器
│   │   ├── HeroManager.js
│   │   ├── ShelterManager.js
│   │   ├── DungeonManager.js
│   │   ├── BattleManager.js
│   │   ├── ItemManager.js
│   │   └── GachaManager.js
│   ├── models/           # 数据模型
│   │   ├── BattleUnit.js
│   │   ├── Hero.js
│   │   ├── Building.js
│   │   ├── Item.js
│   │   └── Dungeon.js
│   └── ui/               # UI层
│       ├── components/     # 通用组件
│       │   ├── Button.js
│       │   ├── Modal.js
│       │   ├── Toast.js
│       │   ├── ProgressBar.js
│       │   ├── ItemCard.js
│       │   ├── HeroCard.js
│       │   └── Pagination.js
│       └── views/          # 场景视图
│           ├── TopBar.js
│           ├── TabBar.js
│           ├── ItemGrid.js
│           ├── ShelterView.js
│           ├── HeroView.js
│           ├── DungeonView.js
│           ├── BattleView.js
│           ├── GachaView.js
│           └── BackpackView.js
├── assets/                # 资源文件
│   ├── icons/            # 图标(Emoji替代)
│   └── images/           # 图片资源
└── data/                  # 外部数据
    └── (预留JSON配置文件)
```

## 游戏系统详解

### 1. 事件系统

使用观察者模式实现模块间解耦:

```javascript
// 监听事件
eventManager.on('heroLevelUp', (hero) => {
    Toast.success(`${hero.name}升级了!`);
});

// 发布事件
eventManager.emit('heroLevelUp', hero);
```

### 2. 存档系统

自动存档(30秒) + 手动存档(页面关闭):

```javascript
// 保存游戏
saveManager.save(gameData);

// 加载游戏
const saveData = saveManager.load();
```

### 3. 离线产出

根据离线时间计算建筑产出:

```javascript
const offlineSeconds = saveManager.calculateOfflineTime();
const production = shelterManager.calculateOfflineProduction(offlineSeconds);
```

### 4. 战斗系统

回合制自动战斗,支持跳过模式:

```javascript
// 初始化战斗
battleManager.initBattle(heroes, enemies, 'skip' | 'normal');

// 执行战斗
const result = await battleManager.executeBattle();
```

## 核心配置说明

### 英雄配置 (HeroConfig.js)

```javascript
{
    id: 'hero_001',
    name: '剑圣',
    icon: '⚔️',
    rarity: 'legendary',
    baseStats: { hp: 150, attack: 30, defense: 10, speed: 25 },
    skill: { name: '剑气斩', multiplier: 1.5 }
}
```

### 地牢配置 (DungeonConfig.js)

```javascript
{
    id: 'dungeon_001',
    name: '废弃工厂',
    icon: '🏭',
    level: 1,
    energyCost: 5,
    enemies: [
        { id: 'enemy_zombie', count: 1 }
    ],
    rewards: {
        gold: { min: 50, max: 100 },
        exp: { min: 20, max: 40 }
    }
}
```

## 扩展开发

### 添加新英雄

1. 在 `HeroConfig.js` 添加英雄配置
2. 在 `DungeonConfig.js` 可选添加作为敌人
3. 运行游戏测试

### 添加新地牢

1. 在 `DungeonConfig.js` 添加地牢配置
2. 设置 enemies(敌人列表) 和 rewards(奖励)
3. 运行游戏测试

### 添加新道具

1. 在 `ItemConfig.js` 添加道具配置
2. 设置类型(resource/consumable/weapon/armor)
3. 运行游戏测试

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

建议使用现代浏览器以获得最佳体验。

## 已知问题

1. 首次加载可能会有短暂延迟(初始化阶段)
2. 战斗动画在低端设备可能不够流畅
3. 存档数据量较大时可能影响性能

## 未来计划

- [ ] 添加背景音乐和音效
- [ ] 实现成就系统
- [ ] 添加排行榜功能
- [ ] 支持多人联机
- [ ] 添加更多英雄和地牢
- [ ] 优化战斗动画效果

## 许可证

MIT License

## 联系方式

如有问题或建议,欢迎反馈!

---

**享受游戏! 🎮**
