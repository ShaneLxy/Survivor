const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const scanRoots = [
    'js',
    'css',
    'gm-desktop/src',
    'server/src',
    'data',
    'index.html',
    'gm-desktop/index.html'
];

const textExtensions = new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx',
    '.json', '.html', '.css', '.md',
    '.yml', '.yaml', '.txt'
]);

const suspiciousMatchers = [
    { name: 'question-only text', test: text => /\?{3,}/.test(text) },
    { name: 'replacement char', test: text => text.includes('\uFFFD') },
    { name: 'common mojibake latin', test: text => /[ÃÂ][^\s]{0,2}/.test(text) },
    { name: 'common mojibake cjk', test: text => /锟斤拷|鈥|鏆|鍏|寮|娑|绛|鐧|鐗|濂|浜|鎴|鎺|閿/.test(text) }
];

const findings = [];

function shouldScan(filePath) {
    return textExtensions.has(path.extname(filePath).toLowerCase());
}

function scanFile(filePath) {
    const absPath = path.join(rootDir, filePath);
    let text;
    try {
        text = fs.readFileSync(absPath, 'utf8');
    } catch (error) {
        findings.push({
            filePath,
            line: 0,
            type: 'read-error',
            preview: error.message
        });
        return;
    }

    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
        suspiciousMatchers.forEach((matcher) => {
            if (matcher.test(line)) {
                findings.push({
                    filePath,
                    line: index + 1,
                    type: matcher.name,
                    preview: line.trim().slice(0, 160)
                });
            }
        });
    });
}

function walk(relPath) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) {
        return;
    }
    const stat = fs.statSync(absPath);
    if (stat.isFile()) {
        if (shouldScan(relPath)) {
            scanFile(relPath);
        }
        return;
    }
    for (const entry of fs.readdirSync(absPath, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
        }
        walk(path.join(relPath, entry.name));
    }
}

for (const scanRoot of scanRoots) {
    walk(scanRoot);
}

if (!findings.length) {
    console.log('No suspicious mojibake patterns found.');
    process.exit(0);
}

console.log('Suspicious mojibake patterns found:\n');
for (const finding of findings) {
    console.log(`${finding.filePath}:${finding.line} [${finding.type}] ${finding.preview}`);
}
process.exit(1);
