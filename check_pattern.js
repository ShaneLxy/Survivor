const fs = require('fs');
const path = require('path');

// 使用 acorn 或简单的语法检查
const files = [
    'js/core/EventManager.js',
    'js/core/SaveManager.js',
    'js/core/AudioManager.js',
    'js/core/Utils.js',
    'js/config/GameConfig.js',
    'js/config/HeroConfig.js',
    'js/config/DungeonConfig.js',
    'js/config/BuildingConfig.js',
    'js/config/ItemConfig.js',
    'js/config/GachaConfig.js',
    'js/models/BattleUnit.js',
    'js/models/Hero.js',
    'js/models/Building.js',
    'js/models/Item.js',
    'js/models/Dungeon.js',
    'js/managers/HeroManager.js',
    'js/managers/ShelterManager.js',
    'js/managers/DungeonManager.js',
    'js/managers/BattleManager.js',
    'js/managers/ItemManager.js',
    'js/managers/GachaManager.js',
    'js/ui/components/Button.js',
    'js/ui/components/Modal.js',
    'js/ui/components/Toast.js',
    'js/ui/components/ProgressBar.js',
    'js/ui/components/ItemCard.js',
    'js/ui/components/HeroCard.js',
    'js/ui/components/Pagination.js',
    'js/ui/views/TopBar.js',
    'js/ui/views/TabBar.js',
    'js/ui/views/ItemGrid.js',
    'js/ui/views/ShelterView.js',
    'js/ui/views/HeroView.js',
    'js/ui/views/DungeonView.js',
    'js/ui/views/BattleView.js',
    'js/ui/views/GachaView.js',
    'js/ui/views/BackpackView.js',
    'js/main.js'
];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 检查常见的问题模式
        const lines = content.split('\n');
        const lastLines = lines.slice(-10);
        const lastLinesStr = lastLines.join('\n');
        
        // 检查双大括号
        if (/\}\s*\}/.test(lastLinesStr)) {
            console.log(`可能有问题: ${file}`);
            console.log('最后10行:');
            lastLines.forEach((line, i) => {
                console.log(`${lines.length - 10 + i + 1}: ${line}`);
            });
            console.log('');
        }
    }
});

console.log('检查完成!');
