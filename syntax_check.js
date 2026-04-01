const fs = require('fs');
const path = require('path');

function checkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            checkDir(fullPath);
        } else if (file.endsWith('.js')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                new Function(content);
                console.log('OK: ' + fullPath);
            } catch(e) {
                console.log('ERROR: ' + fullPath);
                console.log('  ' + e.message);
            }
        }
    });
}

checkDir('js');
