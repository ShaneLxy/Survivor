(function() {
    if (typeof BattleView === 'undefined') {
        return;
    }

    function getStoryDialogues(dungeonId) {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        if (!dungeon) {
            return null;
        }
        const dialogues = dungeon.storyDialogues || dungeon.story?.dialogues || null;
        if (!Array.isArray(dialogues) || dialogues.length === 0) {
            return null;
        }
        return dialogues;
    }

    function isDungeonCompleted(dungeonId) {
        return dungeonManager.isCompleted(dungeonId);
    }

    function getStoryBackground(view, dungeonId) {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        const chapter = (window.DungeonChapterConfig || []).find((entry) => {
            const dungeonIds = Array.isArray(entry?.dungeonIds) ? entry.dungeonIds : [];
            return dungeonId && dungeonIds.includes(dungeonId);
        });
        const background = chapter?.battleBackground
            || chapter?.background
            || dungeon?.battleBackground
            || window.GameSceneBackgrounds?.battle?.src
            || '';
        const resolved = typeof view?.resolveAssetUrl === 'function' ? view.resolveAssetUrl(background) : background;
        if (!resolved) {
            return '';
        }
        return /^(?:https?:|data:|blob:|\/)/i.test(resolved)
            ? resolved
            : `/${String(resolved).replace(/^\.\//, '')}`;
    }

    function playStoryDialogue(dialogues, onComplete, options = {}) {
        if (!window.StoryDialogue) {
            console.warn('[StoryDialogue] StoryDialogue component not loaded');
            onComplete();
            return;
        }

        new StoryDialogue(dialogues, {
            typingSpeed: 60,
            backgroundImage: options.backgroundImage || '',
            segmentCharLimit: 50,
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

    const originalStartBattle = BattleView.prototype.startBattle;
    BattleView.prototype.startBattle = async function(dungeonId, sceneId = 'standard_9x9') {
        const isCompleted = isDungeonCompleted(dungeonId);
        const dialogues = getStoryDialogues(dungeonId);

        if (!isCompleted && dialogues) {
            const backgroundImage = getStoryBackground(this, dungeonId);
            const backgroundStyle = backgroundImage
                ? ` style="--battle-bg-image:url(&quot;${backgroundImage}&quot;)"`
                : '';

            this.show();
            this.element.innerHTML = `
                <div class="scene-view battle-view battle-view-themed battle-story-preview"${backgroundStyle}>
                    <div class="battle-loading-placeholder">
                        <div class="battle-loading-text">准备战斗...</div>
                    </div>
                </div>
            `;

            await new Promise((resolve) => {
                playStoryDialogue(dialogues, resolve, { backgroundImage });
            });
        }

        return originalStartBattle.call(this, dungeonId, sceneId);
    };
})();
