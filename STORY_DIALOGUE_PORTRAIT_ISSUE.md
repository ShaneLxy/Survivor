# 剧情对话立绘不显示问题诊断

## 问题描述

剧情对话中没有显示英雄的立绘（上半身图）。

---

## 问题分析

### 1. 代码逻辑已修复

我已经修复了 `js/ui/components/StoryDialogue.js` 中的 `updateAvatar` 方法，现在它会：

1. **根据 `dialogue.speaker` 字段匹配英雄**（如 `"hero_001"`）
2. 从 `HeroConfig` 中获取该英雄的配置
3. 使用 `portrait` 或 `cardPortrait` 字段作为立绘图片

**修复后的代码：**
```javascript
if (dialogue.avatarType === 'hero') {
    // 根据 speaker 字段匹配英雄立绘
    if (dialogue.speaker) {
        // 如果指定了 speaker（如 "hero_001"），使用该英雄的立绘
        const heroConfig = HeroConfig.getHeroConfig(dialogue.speaker);
        portraitSrc = heroConfig?.portrait || heroConfig?.cardPortrait || heroConfig?.iconSrc;
    } else {
        // 如果没有指定 speaker，使用玩家队伍第一个英雄的立绘（兜底逻辑）
        const firstHero = heroManager?.team?.[0] ? heroManager.getHero(heroManager.team[0]) : null;
        if (firstHero) {
            const heroConfig = HeroConfig.getHeroConfig(firstHero.configId);
            portraitSrc = heroConfig?.portrait || heroConfig?.cardPortrait || heroConfig?.iconSrc;
        }
    }
}
```

### 2. 配置数据不匹配

**问题根源：** GM工具中配置的剧情对话使用了 `"speaker": "hero_001"`，但是这个英雄在GM工具的英雄配置中**不存在**！

**当前GM工具中的英雄：**
- `hero_029` - 绝境末刃-破狱
- `hero_022` - （另一个英雄）

**剧情对话中配置的说话者：**
```json
{
  "speaker": "hero_001",
  "speakerName": "破伤风-断钉",
  "avatarType": "hero",
  "position": "left",
  "text": "空气过滤系统快停了……得赶紧出去找零件。"
}
```

由于 `hero_001` 不存在，`HeroConfig.getHeroConfig("hero_001")` 返回 `null`，所以无法获取立绘。

---

## 解决方案

有两种解决方案：

### 方案1：在GM工具中添加 hero_001 英雄配置（推荐）

在GM工具的"英雄管理"中添加一个ID为 `hero_001` 的英雄，并配置：
- **ID**: `hero_001`
- **名称**: `破伤风-断钉`
- **立绘图片**: 上传英雄的上半身立绘图片到 `portrait` 字段
- **卡牌立绘**: 上传到 `cardPortrait` 字段（可选）

**示例配置：**
```json
{
  "id": "hero_001",
  "name": "破伤风-断钉",
  "icon": "破",
  "portrait": "assets/media/heroes/hero_001.png",
  "cardPortrait": "assets/media/heroesCardPortrait/hero_001.png",
  "rarity": "common",
  "profession": "warrior",
  "description": "一名从避难所中醒来的幸存者",
  "baseStats": {
    "hp": 100,
    "attack": 20,
    "defense": 10,
    "speed": 8,
    "crit": 10,
    "antiCrit": 5,
    "defensePen": 0,
    "accuracy": 10,
    "dodge": 5,
    "attackRange": 1,
    "moveRange": 2
  }
}
```

### 方案2：修改剧情对话配置，使用现有英雄

在GM工具的"章节关卡"中，修改剧情对话的 `speaker` 字段，改为使用现有的英雄ID：

**修改前：**
```json
{
  "speaker": "hero_001",
  "speakerName": "破伤风-断钉",
  "avatarType": "hero",
  "position": "left",
  "text": "空气过滤系统快停了……得赶紧出去找零件。"
}
```

**修改后（使用 hero_029）：**
```json
{
  "speaker": "hero_029",
  "speakerName": "绝境末刃-破狱",
  "avatarType": "hero",
  "position": "left",
  "text": "空气过滤系统快停了……得赶紧出去找零件。"
}
```

---

## 验证步骤

### 1. 添加或修改配置后

在GM工具中保存配置后，刷新游戏前端。

### 2. 使用F12控制台验证

```javascript
// 检查英雄配置是否存在
const heroConfig = HeroConfig.getHeroConfig('hero_001');
console.log('hero_001 配置:', heroConfig);

if (heroConfig) {
    console.log('✅ hero_001 存在');
    console.log('portrait:', heroConfig.portrait);
    console.log('cardPortrait:', heroConfig.cardPortrait);
} else {
    console.log('❌ hero_001 不存在');
    console.log('可用的英雄:', HeroConfig.getAllHeroes().map(h => h.id));
}
```

### 3. 功能测试

1. 进入配置了剧情的关卡
2. 观察剧情对话
3. 确认英雄立绘正确显示在左侧

---

## 立绘图片要求

### 图片规格
- **尺寸**: 建议 400x600 像素（宽x高）或更高分辨率
- **格式**: PNG（支持透明背景）
- **内容**: 英雄上半身（头部到腰部）
- **背景**: 透明或纯色背景

### 图片路径
- **portrait**: `assets/media/heroes/hero_001.png`
- **cardPortrait**: `assets/media/heroesCardPortrait/hero_001.png`

### CSS显示效果
立绘会显示在对话框左侧，容器大小为：
- 桌面端: 200x300 像素
- 移动端: 120x180 像素
- 使用 `object-fit: contain` 保持图片比例

---

## 技术细节

### 数据流转

```
GM工具配置剧情对话
    ↓
dialogue.speaker = "hero_001"
dialogue.avatarType = "hero"
    ↓
StoryDialogue.updateAvatar()
    ↓
HeroConfig.getHeroConfig("hero_001")
    ↓
获取 heroConfig.portrait 或 heroConfig.cardPortrait
    ↓
显示立绘图片
```

### 兜底逻辑

如果 `dialogue.speaker` 为空或未指定，代码会使用玩家队伍中第一个英雄的立绘作为兜底：

```javascript
const firstHero = heroManager?.team?.[0] ? heroManager.getHero(heroManager.team[0]) : null;
if (firstHero) {
    const heroConfig = HeroConfig.getHeroConfig(firstHero.configId);
    portraitSrc = heroConfig?.portrait || heroConfig?.cardPortrait || heroConfig?.iconSrc;
}
```

### 占位符显示

如果无法获取立绘图片，会显示一个占位符：
- 显示说话者名字的第一个字
- 蓝色渐变背景
- 发光效果

---

## 相关文件

### 修改的文件
- `js/ui/components/StoryDialogue.js` - 修复了立绘匹配逻辑

### 需要配置的地方
- **GM工具 → 英雄管理** - 添加或修改英雄配置
- **GM工具 → 章节关卡 → 剧情对话** - 配置 speaker 字段

### 样式文件
- `css/story-dialogue.css` - 立绘显示样式

---

## 常见问题

### Q1: 立绘显示不完整或被裁剪

**原因**: 图片尺寸比例与容器不匹配

**解决方案**: 
- 使用 2:3 的宽高比（如 400x600）
- 或者调整CSS中的 `object-fit` 属性

### Q2: 立绘不显示，只显示占位符

**原因**: 
1. 英雄配置不存在（如 `hero_001` 不存在）
2. `portrait` 和 `cardPortrait` 字段为空
3. 图片路径错误

**解决方案**:
1. 在GM工具中添加英雄配置
2. 配置正确的图片路径
3. 确保图片文件存在于服务器上

### Q3: 图片加载失败（显示破损图标）

**原因**: 图片文件不存在或路径错误

**解决方案**:
1. 检查图片文件是否存在于 `assets/media/heroes/` 目录
2. 检查文件名是否与配置中的路径一致
3. 检查文件权限

### Q4: 想要显示全身立绘而不是上半身

**解决方案**: 修改 CSS 中的容器高度

```css
.story-dialogue-avatar {
    width: 200px;
    height: 400px;  /* 增加高度 */
    flex-shrink: 0;
    position: relative;
}
```

---

## 总结

立绘不显示的根本原因是：**剧情对话中配置的 `speaker: "hero_001"` 在GM工具的英雄配置中不存在**。

解决方法：
1. **推荐**: 在GM工具中添加 `hero_001` 英雄配置，并上传立绘图片
2. **备选**: 修改剧情对话配置，使用现有的英雄ID（如 `hero_029`）

代码逻辑已经修复，现在会正确根据 `speaker` 字段匹配英雄并显示立绘。

---

**诊断完成时间**: 2026-05-31  
**诊断人员**: Kiro AI Assistant
