const { execSync } = require('child_process');
const path = require('path');

const git = 'c:\\Users\\USER\\.workbuddy\\vendor\\PortableGit\\cmd\\git.exe';
const cwd = 'd:\\PRIVACY-REDACTED\\xTrae\\YiQi-MD-Editor';

function run(cmd) {
  try {
    const result = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30000 });
    return { success: true, output: result };
  } catch (e) {
    return { success: false, error: e.message, output: e.stdout?.toString() || '' };
  }
}

// Configure git
run(`"${git}" config user.email "YiQi@md-editor.com"`);
run(`"${git}" config user.name "YiQi"`);

// Add remote (ignore error if exists)
const remoteResult = run(`"${git}" remote add origin git@github.com:WangXP7/YiQi-MD-Editor.git`);

// Add all files
run(`"${git}" add -A`);

// Commit
const commitResult = run(`"${git}" commit -m "feat: YiQi@MD-Editor-Trae-SeedCode v1.0.0 - Beautiful Markdown Editor"`);

// Rename branch to main
run(`"${git}" branch -M main`);

// Push
const pushResult = run(`"${git}" push -u origin main`);

console.log('=== Git Setup Complete ===');
console.log('Commit:', commitResult.success ? 'OK' : 'FAILED');
if (!commitResult.success) console.log('Error:', commitResult.error);
console.log('Push:', pushResult.success ? 'OK' : 'FAILED');
if (!pushResult.success) console.log('Error:', pushResult.error);
if (pushResult.output) console.log('Push output:', pushResult.output.substring(0, 500));
