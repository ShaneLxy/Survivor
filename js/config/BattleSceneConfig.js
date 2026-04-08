/**
 * 战斗场景配置
 */
const BattleSceneConfig = {
    scenes: {
        standard_9x9: {
            id: 'standard_9x9',
            name: '常规战场',
            width: 7,
            height: 10,
            actionTimeout: 15,

            heroSpawn: {
                startRow: 9,
                direction: -1
            },
            enemySpawn: {
                startRow: 0,
                direction: 1
            }
        }
    },

    getScene(sceneId = 'standard_9x9') {
        return this.scenes[sceneId] || this.scenes.standard_9x9;
    }
};

window.BattleSceneConfig = BattleSceneConfig;
