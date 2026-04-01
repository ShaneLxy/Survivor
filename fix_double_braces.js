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

let fixedCount = 0;

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // 查找连续的 }} 并替换为 }
        const before = content.length;
        content = content.replace(/}}\s*$/gm, '}');
        
        if (content.length !== before) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Fixed double }} in: ${file}`);
            fixedCount++;
        }
    }
});

console.log(`\nTotal files fixed: ${fixedCount}`);
