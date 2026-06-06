# GM工具剧情对话编辑器优化

## 修改日期：2026-05-31

---

## 优化内容

### 1. 将"说话者ID"文本框改为下拉选择框

**优化前：**
- 用户需要手动输入英雄或怪物的ID（如 `hero_001`）
- 容易输错ID
- 需要记住或查找ID，非常不方便

**优化后：**
- 改为下拉选择框，显示格式：`名称 (ID)`
- 例如：`绝境末刃-破狱 (hero_029)`
- 自动按名称排序，方便查找
- 选择后自动填充"显示名称"字段

### 2. 立绘类型联动

当切换"立绘类型"时，"说话者"下拉框会自动更新：
- **玩家英雄**：显示所有英雄列表
- **敌人**：显示所有怪物列表
- **无(旁白)**：说话者可以留空

### 3. 自动填充显示名称

选择说话者后，如果"显示名称"字段为空，会自动填充该角色的名称。

---

## 功能确认

### ✅ 支持英雄立绘

- **立绘类型**：选择"玩家英雄"
- **说话者**：从下拉框选择英雄
- **前端显示**：使用 `HeroConfig.getHeroConfig(speaker)` 获取英雄的 `portrait` 或 `cardPortrait` 字段

### ✅ 支持怪物立绘

- **立绘类型**：选择"敌人"
- **说话者**：从下拉框选择怪物
- **前端显示**：使用 `DungeonConfig.getEnemyConfig(speaker)` 获取怪物的 `portrait` 字段

### ✅ 支持旁白模式

- **立绘类型**：选择"无(旁白)"
- **说话者**：可以留空
- **前端显示**：不显示立绘，对话框居中

---

## 使用方法

### 步骤1：添加剧情对话

在GM工具的"章节关卡"编辑页面，找到"剧情对话"部分，点击"添加对话"按钮。

### 步骤2：选择立绘类型

根据说话者的类型选择：
- **玩家英雄**：游戏中的可招募英雄
- **敌人**：游戏中的怪物/敌人
- **无(旁白)**：旁白或无需立绘的对话

### 步骤3：选择说话者

从下拉框中选择具体的角色：
- 下拉框会显示所有可用的角色
- 格式：`角色名称 (角色ID)`
- 例如：`绝境末刃-破狱 (hero_029)`

### 步骤4：确认显示名称

选择说话者后，"显示名称"会自动填充。如果需要，可以手动修改。

### 步骤5：输入对话文本

在"对话文本"框中输入该角色要说的话。

### 步骤6：调整立绘位置

选择立绘显示在对话框的左侧还是右侧。

### 步骤7：保存

点击"保存关卡"按钮保存配置。

---

## 示例配置

### 示例1：英雄对话

```
立绘类型：玩家英雄
说话者：绝境末刃-破狱 (hero_029)
显示名称：绝境末刃-破狱
立绘位置：左侧
对话文本：空气过滤系统快停了……得赶紧出去找零件。
```

**前端效果：**
- 左侧显示"绝境末刃-破狱"的上半身立绘
- 对话框显示角色名和对话内容

### 示例2：怪物对话

```
立绘类型：敌人
说话者：掠夺者 (enemy_raider)
显示名称：掠夺者
立绘位置：右侧
对话文本：发现目标！准备攻击！
```

**前端效果：**
- 右侧显示"掠夺者"的立绘
- 对话框显示怪物名和对话内容

### 示例3：旁白

```
立绘类型：无(旁白)
说话者：（留空）
显示名称：旁白
立绘位置：左侧（无效）
对话文本：72号避难所，休眠舱区。沉睡了多久？系统日志显示：1847天。
```

**前端效果：**
- 不显示立绘
- 对话框居中显示
- 显示旁白内容

---

## 技术实现

### 修改的文件

`gm-desktop/src/app.js`

### 新增函数

```javascript
function buildSpeakerOptions(avatarType, currentValue) {
  let options = '';

  if (avatarType === 'hero') {
    // 获取所有英雄
    const heroes = (state.catalog?.heroes || []).sort((a, b) => {
      return (a.name || a.id).localeCompare(b.name || b.id, 'zh-CN');
    });

    heroes.forEach(hero => {
      const selected = hero.id === currentValue ? 'selected' : '';
      const displayText = `${hero.name || hero.id} (${hero.id})`;
      options += `<option value="${escapeHtml(hero.id)}" data-name="${escapeHtml(hero.name || '')}" ${selected}>${escapeHtml(displayText)}</option>`;
    });
  } else if (avatarType === 'enemy') {
    // 获取所有敌人
    const enemies = (state.catalog?.enemies || []).sort((a, b) => {
      return (a.name || a.id).localeCompare(b.name || b.id, 'zh-CN');
    });

    enemies.forEach(enemy => {
      const selected = enemy.id === currentValue ? 'selected' : '';
      const displayText = `${enemy.name || enemy.id} (${enemy.id})`;
      options += `<option value="${escapeHtml(enemy.id)}" data-name="${escapeHtml(enemy.name || '')}" ${selected}>${escapeHtml(displayText)}</option>`;
    });
  }

  return options;
}
```

### 修改的函数

`renderStoryDialogueRows(entries)` - 渲染剧情对话编辑行

**主要改动：**
1. 将"说话者ID"文本框改为下拉选择框
2. 添加立绘类型变化事件监听
3. 添加说话者选择事件监听，自动填充显示名称

---

## 数据流转

```
GM工具配置
    ↓
用户选择立绘类型（hero/enemy/none）
    ↓
buildSpeakerOptions() 根据类型生成选项列表
    ↓
用户从下拉框选择角色
    ↓
自动填充显示名称
    ↓
保存到 storyDialogues 数组
    ↓
同步到服务器
    ↓
前端加载并显示
```

---

## 前端立绘显示逻辑

### 英雄立绘

```javascript
if (dialogue.avatarType === 'hero') {
    if (dialogue.speaker) {
        const heroConfig = HeroConfig.getHeroConfig(dialogue.speaker);
        portraitSrc = heroConfig?.portrait || heroConfig?.cardPortrait || heroConfig?.iconSrc;
    }
}
```

### 怪物立绘

```javascript
else if (dialogue.avatarType === 'enemy' && dialogue.speaker) {
    const enemyConfig = DungeonConfig.getEnemyConfig(dialogue.speaker);
    portraitSrc = enemyConfig?.portrait;
}
```

### 旁白模式

```javascript
if (!dialogue.avatarType || dialogue.avatarType === 'none') {
    // 不显示立绘，对话框居中
    this.avatarElement.style.display = 'none';
    this.container.classList.add('narrator-mode');
}
```

---

## 注意事项

### 1. 立绘图片要求

- **英雄立绘**：需要在英雄配置中设置 `portrait` 或 `cardPortrait` 字段
- **怪物立绘**：需要在怪物配置中设置 `portrait` 字段
- **图片格式**：PNG（支持透明背景）
- **推荐尺寸**：400x600 像素（宽x高）或更高分辨率

### 2. 如果立绘不显示

检查以下几点：
1. 角色配置中是否有 `portrait` 字段
2. 图片路径是否正确
3. 图片文件是否存在于服务器上
4. 浏览器控制台是否有加载错误

### 3. 显示名称可以自定义

虽然选择说话者后会自动填充显示名称，但你可以手动修改为任何你想要的名字。例如：
- 角色名：`绝境末刃-破狱`
- 自定义显示名：`破狱`、`末刃`、`神秘人` 等

---

## 优化效果

### 优化前的问题

1. ❌ 需要记住或查找角色ID
2. ❌ 容易输错ID导致立绘不显示
3. ❌ 需要手动输入显示名称
4. ❌ 不知道有哪些角色可用

### 优化后的改进

1. ✅ 从下拉框直接选择，无需记忆ID
2. ✅ 避免输入错误
3. ✅ 自动填充显示名称
4. ✅ 清楚看到所有可用角色
5. ✅ 按名称排序，方便查找
6. ✅ 立绘类型联动，只显示相关角色

---

## 相关文件

### 修改的文件
- `gm-desktop/src/app.js` - GM工具前端代码

### 涉及的文件（未修改）
- `js/ui/components/StoryDialogue.js` - 前端剧情对话组件
- `js/models/Dungeon.js` - 副本模型
- `server/src/modules/gm/gm-catalog.service.ts` - 服务器端数据处理

---

## 总结

这次优化大大提升了GM工具剧情对话编辑器的用户体验：

1. **更直观**：下拉选择代替手动输入
2. **更准确**：避免ID输入错误
3. **更高效**：自动填充显示名称
4. **更友好**：清楚看到所有可用角色

同时确认了前端代码**完全支持英雄和怪物立绘**，只要在GM工具中正确配置，立绘就能正常显示。

---

**优化完成时间**: 2026-05-31  
**优化人员**: Kiro AI Assistant  
**版本**: v1.2.0
