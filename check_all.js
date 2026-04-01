const fs = require('fs');
const path = require('path');

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

let errors = [];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');

        // 检查语法: 尝试用 Function 构造器解析
        try {
            new Function(content);
            console.log(`✅ ${file}`);
        } catch (e) {
            console.log(`❌ ${file}: ${e.message}`);
            errors.push({ file, error: e.message });

            // 显示错误附近的代码
            const lines = content.split('\n');
            console.log('Last 5 lines of file:');
            lines.slice(-5).forEach((line, i) => {
                console.log(`  ${lines.length - 5 + i + 1}: ${line}`);
            });
            console.log('');
        }
    }
});

if (errors.length > 0) {
    console.log(`\n❌ Found ${errors.length} errors!`);
    process.exit(1);
} else {
    console.log('\n✅ All files are valid!');
    process.exit(0);
}
