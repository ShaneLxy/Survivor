# 剧情对话系统 - 功能总结

## 🎯 核心功能

### 1. 战前剧情播放
- 关卡首次挑战时自动播放剧情对话
- 打字机效果逐字显示
- 支持多轮对话和角色切换
- 左侧显示角色立绘

### 2. 剧情回顾功能 ⭐ NEW
- 已通关关卡可以回顾剧情
- 在暂停菜单中点击"回顾剧情"按钮
- 随时重温关卡的故事内容

### 3. GM工具配置
- 可视化编辑器
- 支持添加/删除/排序对话
- 实时预览功能

## 📱 使用方法

### 玩家视角
1. **首次挑战**：进入关卡后自动播放剧情
2. **回顾剧情**：
   - 在已通关的关卡中
   - 点击左上角暂停按钮（II）
   - 选择"回顾剧情"
   - 重新观看剧情对话

### 开发者视角
1. 打开GM工具 → 副本关卡
2. 选择关卡 → 找到"剧情对话"区域
3. 添加对话内容
4. 预览效果 → 保存

## 🎨 对话类型

### 角色对话
```javascript
{
  "speaker": "hero_001",
  "speakerName": "艾莉娅",
  "avatarType": "hero",
  "position": "left",
  "text": "这里就是传说中的遗迹吗..."
}
```

### 旁白叙述
```javascript
{
  "speaker": "",
  "speakerName": "",
  "avatarType": "none",
  "position": "left",
  "text": "远处传来了怪物的咆哮声..."
}
```

### 敌人对话
```javascript
{
  "speaker": "enemy_boss",
  "speakerName": "守护者",
  "avatarType": "enemy",
  "position": "right",
  "text": "入侵者...必须...消灭..."
}
```

## 🔧 技术实现

### 核心文件
- `js/ui/components/StoryDialogue.js` - 对话组件
- `js/ui/views/BattleView.js` - 战斗场景集成
- `js/ui/views/BattleStoryPatch.js` - 首通播放逻辑
- `css/story-dialogue.css` - 样式
- `gm-desktop/src/app.js` - GM工具编辑器

### 关键方法
- `BattleView.pauseBattle()` - 暂停菜单（包含回顾剧情按钮）
- `BattleView.reviewStory()` - 回顾剧情功能
- `StoryDialogue` - 对话播放组件

## ✨ 特色功能

1. **智能跳过**
   - 第一次点击：显示完整文本
   - 第二次点击：进入下一句

2. **首通判断**
   - 自动检测关卡是否已通关
   - 首次挑战自动播放
   - 通关后可手动回顾

3. **立绘系统**
   - 自动获取英雄/敌人立绘
   - 支持左右位置切换
   - 角色切换时淡入淡出

4. **移动端适配**
   - 响应式布局
   - 小屏幕自动隐藏立绘
   - 触摸操作优化

## 📊 使用场景

### 场景1：关卡开场
- 介绍关卡背景
- 设定故事氛围
- 引导玩家进入战斗

### 场景2：角色互动
- 展现角色性格
- 推进剧情发展
- 增强代入感

### 场景3：BOSS登场
- 营造紧张氛围
- 介绍BOSS背景
- 提升战斗期待感

### 场景4：剧情回顾
- 玩家想重温剧情
- 截图分享故事
- 理解关卡背景

## 🎮 测试方法

1. **测试页面**：打开 `test_story_dialogue.html`
2. **GM预览**：在GM工具中点击"预览效果"
3. **游戏测试**：进入配置了剧情的关卡

## 📝 配置示例

完整的关卡剧情配置：

```json
{
  "id": "dungeon_001",
  "name": "废墟探索",
  "storyDialogues": [
    {
      "speaker": "",
      "speakerName": "",
      "avatarType": "none",
      "position": "left",
      "text": "第一章 - 废墟中的遭遇"
    },
    {
      "speaker": "hero_001",
      "speakerName": "艾莉娅",
      "avatarType": "hero",
      "position": "left",
      "text": "这里就是传说中的遗迹吗..."
    },
    {
      "speaker": "hero_002",
      "speakerName": "雷恩",
      "avatarType": "hero",
      "position": "right",
      "text": "小心，我感觉到了危险的气息。"
    },
    {
      "speaker": "",
      "speakerName": "",
      "avatarType": "none",
      "position": "left",
      "text": "突然，地面开始剧烈震动！"
    },
    {
      "speaker": "enemy_boss",
      "speakerName": "???",
      "avatarType": "enemy",
      "position": "right",
      "text": "入侵者...必须...消灭..."
    },
    {
      "speaker": "hero_001",
      "speakerName": "艾莉娅",
      "avatarType": "hero",
      "position": "left",
      "text": "准备战斗！"
    }
  ]
}
```

## 🚀 未来扩展

可能的功能增强：
- [ ] 立绘表情变体
- [ ] 对话历史记录
- [ ] 自动播放模式
- [ ] 文字特效
- [ ] 配音支持
- [ ] 战斗中对话
- [ ] 分支对话选择
- [ ] CG插图

## 📚 相关文档

- `STORY_DIALOGUE_GUIDE.md` - 完整使用指南
- `test_story_dialogue.html` - 功能测试页面

---

**版本**: v1.1.0  
**更新日期**: 2026-05-31  
**开发者**: Kiro AI Assistant
