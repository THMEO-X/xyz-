const { execSync } = require('child_process');
const { spawn } = require('child_process');

const packages = [
  'axios',
  'axios-cookiejar-support',
  'chalk@4',
  'chokidar',
  'discord.js-selfbot-v13',
  'dotenv',
  'express',
  'fs',
  'https',
  'node-cron',
  'path',
  'sharp',
  'tough-cookie',
  'web-push',
  'worker_threads',
];

console.log('Bat dau cai packages...\n');

for (const pkg of packages) {
  try {
    process.stdout.write(`  Cai ${pkg}...`);
    execSync(`npm install ${pkg}`, { stdio: 'ignore' });
    console.log(' OK');
  } catch (err) {
    console.log(` LOI: ${err.message}`);
  }
}

console.log('\nXong! Tat ca packages da duoc cai.\n');
console.log('Dang khoi dong index.js...\n');

const child = spawn('node', ['index.js'], { stdio: 'inherit' });
child.on('error', (err) => console.error('Loi khoi dong:', err.message));
child.on('exit', (code) => console.log(`\nindex.js ket thuc voi code ${code}`));
