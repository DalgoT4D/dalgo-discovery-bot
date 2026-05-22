#!/usr/bin/env node
import { hash } from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: npm run admin:hash <password>');
  process.exit(1);
}

const h = await hash(pw, 10);
// Escape $ chars so Next.js's env loader doesn't interpret them as variable refs
const escaped = h.replace(/\$/g, '\\$');

console.log('');
console.log('Add these to .env.local (note the backslash-escaped $ — required):');
console.log('');
console.log(`ADMIN_USERNAME=admin`);
console.log(`ADMIN_PASSWORD_HASH=${escaped}`);
console.log('');
