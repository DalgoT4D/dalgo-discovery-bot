#!/usr/bin/env node
import { hash } from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: npm run admin:hash <password>');
  process.exit(1);
}

const h = await hash(pw, 10);
console.log('');
console.log('Add this to .env.local:');
console.log('');
console.log(`ADMIN_USERNAME=admin`);
console.log(`ADMIN_PASSWORD_HASH=${h}`);
console.log('');
