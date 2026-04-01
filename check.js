const fs = require('fs');
const path = require('path');

function checkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            checkDir(fullPath);
        } else if (file.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            try {
                new Function(content);
            } catch(e) {
                console.log('ERROR:', fullPath);
                console.log('  ', e.message);
            }
        }
    }
    console.log('All JS files checked.');
}

checkDir('.');