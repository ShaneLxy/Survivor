/**
 * 战斗剧情对话集成
 * 在首次进入副本时播放剧情对话
 */
(function() {
    // 这里只 monkey-patch BattleView.prototype，不依赖 game/battleView 实例。
    // 之前检查 window.game.ui.battleView 是 bug：那个实例要到 main.js 末尾
    // new Game() 时才创建，而此 patch 是 script 加载时 IIFE 执行的，比 main.js 早，
    // 导致条件永远不成立、patch 永不应用、首通剧情对话从未触发。
    if (typeof BattleView === 'undefined') {
        return;
    }

    /**
     * 检查副本是否有剧情对话配置
     */
    function getStoryDialogues(dungeonId) {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        if (!dungeon) {
            return null;
        }

        // 从副本配置中获取剧情对话
        const dialogues = dungeon.storyDialogues || dungeon.story?.dialogues || null;

        if (!dialogues || !Array.isArray(dialogues) || dialogues.length === 0) {
            return null;
        }

        return dialogues;
    }

    /**
     * 检查副本是否已完成（首通后不再播放剧情）
     */
    function isDungeonCompleted(dungeonId) {
        return dungeonManager.isCompleted(dungeonId);
    }

    /**
     * 播放剧情对话
     */
    function playStoryDialogue(dialogues, onComplete) {
        if (!window.StoryDialogue) {
            console.warn('[StoryDialogue] StoryDialogue component not loaded');
            onComplete();
            return;
        }

        const storyDialogue = new StoryDialogue(dialogues, {
            typingSpeed: 60,
            onComplete: () => {
                console.log('[StoryDialogue] Story dialogue completed');
                onComplete();
            },
            onSkip: () => {
                console.log('[StoryDialogue] Story dialogue skipped');
                onComplete();
            }
        });
    }

    // 拦截 startBattle 方法
    const originalStartBattle = BattleView.prototype.startBattle;
    BattleView.prototype.startBattle = async function(dungeonId, sceneId = 'standard_9x9') {
        // 检查是否需要播放剧情
        const isCompleted = isDungeonCompleted(dungeonId);
        const dialogues = getStoryDialogues(dungeonId);

        if (!isCompleted && dialogues && dialogues.length > 0) {
            console.log('[StoryDialogue] Playing story dialogue for dungeon:', dungeonId);

            // 先显示战斗场景（作为背景）
            this.show();
            this.element.innerHTML = `
                <div class="scene-view battle-view">
                    <div class="battle-loading-placeholder">
                        <div class="battle-loading-text">准备战斗...</div>
                    </div>
                </div>
            `;

            // 播放剧情对话，等待完成
            await new Promise((resolve) => {
                playStoryDialogue(dialogues, resolve);
            });
        }

        // 继续正常的战斗流程
        return originalStartBattle.call(this, dungeonId, sceneId);
    };

    console.log('[StoryDialogue] Battle story dialogue integration loaded');
})();
