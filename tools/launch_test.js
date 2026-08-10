// YiQi@MD-Editor-wb-KimiK3 exe 启动存活验证：启动后等待 7 秒，检查进程是否存活，存活则杀掉。
const { spawn, execSync } = require('child_process');
const path = require('path');

const fs = require('fs');
const EXE_NAME = 'YiQi@MD-Editor-wb-KimiK3-v1.0.0.exe';
const exeRelease = path.join(__dirname, '..', 'release', EXE_NAME);
const exeDist = path.join(__dirname, '..', 'dist', EXE_NAME);
const exe = fs.existsSync(exeRelease) ? exeRelease : exeDist;
const sample = path.join(__dirname, '..', 'test_sample.md');

const child = spawn(exe, [sample], { detached: false, stdio: 'ignore' });
const pid = child.pid;
console.log('spawned PID:', pid);

child.on('error', (err) => {
  console.log('SPAWN ERROR:', err.message);
  process.exit(2);
});

let exited = false;
child.on('exit', (code) => {
  exited = true;
  console.log('EXITED EARLY - code:', code);
});

setTimeout(() => {
  if (exited) {
    console.log('RESULT: FAIL (exited within 7s)');
    process.exit(1);
  }
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}"`).toString();
    if (out.includes(String(pid))) {
      console.log('RESULT: ALIVE after 7s, PID', pid);
      try { execSync(`taskkill /PID ${pid} /F /T`); console.log('killed OK'); }
      catch (e) { console.log('kill warning:', e.message); }
      process.exit(0);
    }
    console.log('RESULT: FAIL (not in tasklist)');
    process.exit(1);
  } catch (e) {
    console.log('RESULT: check error:', e.message);
    process.exit(1);
  }
}, 7000);
