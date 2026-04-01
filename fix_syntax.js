const fs = require('fs');
const path = require('path');

const files = [
    'js/config/BuildingConfig.js',
    'js/config/DungeonConfig.js',
    'js/config/GachaConfig.js',
    'js/config/GameConfig.js',
    'js/config/HeroConfig.js',
    'js/config/ItemConfig.js',
    'js/core/AudioManager.js',
    'js/core/EventManager.js',
    'js/core/SaveManager.js',
    'js/core/Utils.js',
    'js/managers/BattleManager.js',
    'js/managers/DungeonManager.js',
    'js/managers/GachaManager.js',
    'js/managers/HeroManager.js',
    'js/managers/ItemManager.js',
    'js/managers/ShelterManager.js',
    'js/models/BattleUnit.js',
    'js/models/Building.js',
    'js/models/Dungeon.js',
    'js/models/Hero.js',
    'js/models/Item.js',
    'js/ui/components/Button.js',
    'js/ui/components/HeroCard.js',
    'js/ui/components/ItemCard.js',
    'js/ui/components/Modal.js',
    'js/ui/components/Pagination.js',
    'js/ui/components/ProgressBar.js',
    'js/ui/components/Toast.js',
    'js/ui/views/BackpackView.js',
    'js/ui/views/BattleView.js',
    'js/ui/views/DungeonView.js',
    'js/ui/views/GachaView.js',
    'js/ui/views/HeroView.js',
    'js/ui/views/ItemGrid.js',
    'js/ui/views/ShelterView.js',
    'js/ui/views/TabBar.js',
    'js/ui/views/TopBar.js',
    'js/main.js'
];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // 修复双大括号问题: 在文件末尾如果有 }}，则去掉多余的 }
        // 模式: 检查文件末尾是否有 } 后面跟着 window.xxx =
        const lines = content.split('\n');
        let lastLine = lines[lines.length - 1].trim();

        // 检查最后几行是否有语法错误的模式
        // 例如:
        // }
        // window.xxx = xxx;
        // }
        if (lastLine === '}' && lines.length > 2) {
            const prevLine = lines[lines.length - 2].trim();
            if (prevLine.startsWith('window.')) {
                // 找到问题：最后一行是多余的 }
                lines.pop();
                content = lines.join('\n');
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Fixed: ${file}`);
            }
        }
    }
});

console.log('Done!');
