const fs = require('fs');
const content = fs.readFileSync('js/config/BuildingConfig.js', 'utf8');

// 检查常见的语法问题
const issues = [];

// 检查双大括号
const doubleBraceRegex = /\}\s*\}/g;
let match;
while ((match = doubleBraceRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    issues.push(`Line ~${lineNum}: Double closing braces "}}" found`);
}

// 检查不匹配的括号
const opens = (content.match(/\{/g) || []).length;
const closes = (content.match(/\}/g) || []).length;
if (opens !== closes) {
    issues.push(`Mismatched braces: ${opens} opens, ${closes} closes`);
}

// 检查不匹配的方括号
const squareOpens = (content.match(/\[/g) || []).length;
const squareCloses = (content.match(/\]/g) || []).length;
if (squareOpens !== squareCloses) {
    issues.push(`Mismatched square brackets: ${squareOpens} opens, ${squareCloses} closes`);
}

// 检查不匹配的圆括号
const parenOpens = (content.match(/\(/g) || []).length;
const parenCloses = (content.match(/\)/g) || []).length;
if (parenOpens !== parenCloses) {
    issues.push(`Mismatched parentheses: ${parenOpens} opens, ${parenCloses} closes`);
}

if (issues.length > 0) {
    issues.forEach(i => console.log(i));
} else {
    console.log('No obvious issues found in BuildingConfig.js');
}
