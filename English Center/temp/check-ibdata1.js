const fs = require('fs');
const p = 'C:/xampp/mysql/data/ibdata1';
const out = [];
try {
  const s = fs.statSync(p);
  out.push('stat:' + JSON.stringify({ size: s.size, mode: s.mode.toString(8), mtime: s.mtime }));
  try {
    fs.accessSync(p, fs.constants.R_OK | fs.constants.W_OK);
    out.push('access: ok');
  } catch (err) {
    out.push('access: fail ' + err.message);
  }
} catch (err) {
  out.push('stat fail ' + err.message);
}
fs.writeFileSync('temp/ibdata1-node.txt', out.join('\n'), 'utf8');
