const fs = require('fs');
const path = require('path');

function getAllJsx(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) list = list.concat(getAllJsx(p));
    else if (e.name.endsWith('.jsx') || e.name.endsWith('.js')) list.push(p);
  }
  return list;
}

const files = getAllJsx(path.join(__dirname, 'src'));
let issuesFound = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Extract all import declarations
  const importLines = content.split('\n').filter(line => line.trim().startsWith('import '));
  const importedIdentifiers = new Set();
  
  // Also handle multi-line imports
  const importBlocks = content.match(/import\s+[\s\S]*?from\s+['"][^'"]+['"]/g) || [];
  for (const ib of importBlocks) {
    const named = ib.match(/\{([\s\S]*?)\}/);
    if (named) {
      named[1].split(',').forEach(s => {
        const parts = s.trim().split(/\s+as\s+/);
        const item = parts[1] ? parts[1].trim() : parts[0].trim();
        if (item) importedIdentifiers.add(item);
      });
    }
    const def = ib.match(/import\s+([A-Za-z0-9_$]+)\s+(?:,\s*\{|from)/);
    if (def) importedIdentifiers.add(def[1].trim());
  }

  // Extract declared identifiers
  const declared = new Set();
  for (const m of content.matchAll(/(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g)) {
    declared.add(m[1]);
  }

  // Extract all JSX element tags: <TagName
  const jsxTags = [...content.matchAll(/<([A-Z][a-zA-Z0-9_$]*)/g)].map(m => m[1]);
  for (const tag of jsxTags) {
    if (['React', 'Fragment'].includes(tag)) continue;
    if (!importedIdentifiers.has(tag) && !declared.has(tag)) {
      console.error('❌ Missing component/icon in', path.relative(__dirname, file), '->', tag);
      issuesFound++;
    }
  }
}

if (issuesFound === 0) {
  console.log('✅ ALL JSX tags and icons are 100% properly imported and defined!');
} else {
  console.log(`❌ Found ${issuesFound} issues.`);
  process.exit(1);
}
