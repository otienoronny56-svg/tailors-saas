const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let files = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
        if (item === 'node_modules' || item === '.git') continue;
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files = files.concat(walkDir(fullPath));
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('sw.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

const htmlFiles = walkDir(__dirname);
let count = 0;
const newVersion = Date.now().toString();
// Find the old version dynamically by looking at index.html
let indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let match = indexContent.match(/config\.js\?v=(\d+)/);
if (!match) {
    console.log("Could not find old version string in index.html");
    process.exit(1);
}
const oldVersion = match[1];

for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let updated = false;

    if (content.includes(`v=${oldVersion}`)) {
        const regex = new RegExp(`v=${oldVersion}`, 'g');
        content = content.replace(regex, `v=${newVersion}`);
        updated = true;
    }

    // Ensure offline-store.js has ?v= parameter in HTML files
    if (file.endsWith('.html')) {
        if (content.includes('js/core/offline-store.js') && !content.includes('js/core/offline-store.js?v=')) {
            content = content.replace(/js\/core\/offline-store\.js/g, `js/core/offline-store.js?v=${newVersion}`);
            updated = true;
        }
    }

    if (updated) {
        fs.writeFileSync(file, content);
        count++;
    }
}
console.log(`Updated cache buster from ${oldVersion} to ${newVersion} in ${count} files.`);
