import prisma from '../src/prisma.js';
import bcrypt from 'bcryptjs';

async function runAuthTest() {
  console.log('🧪 Testing Auth & Admin Mode Password Verification...');

  // 1. Check Owner account in DB
  const owner = await prisma.user.findFirst({
    where: { role: { in: ['OWNER', 'ADMIN'] } },
  });

  console.log(`Owner found in DB: ${owner ? owner.email : 'None'}`);

  if (owner) {
    const isMatch = await bcrypt.compare('bird123', owner.password);
    console.log(`Password 'bird123' bcrypt matches owner: ${isMatch ? '✅ YES' : '❌ NO'}`);
  }

  // 2. Test wrong password
  const isWrongMatch = owner ? await bcrypt.compare('wrongpassword', owner.password) : false;
  console.log(`Password 'wrongpassword' rejected: ${!isWrongMatch ? '✅ YES' : '❌ NO'}`);

  console.log('\n🎉 Direct Auth Verification Complete!');
  process.exit(0);
}

runAuthTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
