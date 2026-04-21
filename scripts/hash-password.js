/**
 * Run once to generate your admin password hash.
 * Usage: node scripts/hash-password.js
 * Then paste the output into your .env as ADMIN_PASSWORD_HASH=...
 */
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter your admin password: ', async (pw) => {
  if (!pw || pw.length < 8) {
    console.error('❌ Password must be at least 8 characters.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(pw, 12);
  console.log('\n✅ Add this to your .env file:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
  rl.close();
});
