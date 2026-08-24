import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Current Businesses & Locations ---');
  const businesses = await prisma.business.findMany({
    include: {
      locations: true,
      users: true,
    },
  });

  console.log(`Found ${businesses.length} businesses:`);
  for (const b of businesses) {
    console.log(`- [${b.id}] "${b.name}" with ${b.locations.length} locations:`, b.locations.map(l => `${l.name} (${l.type})`));
  }

  // Get or select the primary business to keep
  let mainBusiness = businesses[0];

  if (!mainBusiness) {
    console.log('Creating MI2 Impex business...');
    const user = await prisma.user.findFirst();
    mainBusiness = await prisma.business.create({
      data: {
        name: 'MI2 Impex',
        address: 'Shop 14, Karol Bagh Mobile Spare Market, New Delhi - 110005',
        phone: '+91 98765 43210',
        email: 'sales@mi2impex.com',
        gstin: '07AAAAA0000A1Z5',
        state: 'Delhi',
        billPrefix: 'MI2',
        startingBillNo: 1001,
        terms: '1. Testing warranty 7 days on displays & batteries before installation.\n2. No warranty on physical or flex damage.',
        users: user ? {
          create: {
            userId: user.id,
          },
        } : undefined,
      },
      include: {
        locations: true,
        users: true,
      },
    });
  } else {
    console.log(`Updating primary business ${mainBusiness.id} to "MI2 Impex"...`);
    mainBusiness = await prisma.business.update({
      where: { id: mainBusiness.id },
      data: {
        name: 'MI2 Impex',
        billPrefix: 'MI2',
      },
      include: {
        locations: true,
        users: true,
      },
    });
  }

  // Delete all other businesses
  const otherBusinesses = businesses.filter(b => b.id !== mainBusiness.id);
  for (const ob of otherBusinesses) {
    console.log(`Deleting other business: [${ob.id}] "${ob.name}"`);
    await prisma.business.delete({
      where: { id: ob.id },
    });
  }

  // Check locations for MI2 Impex
  const currentLocations = await prisma.location.findMany({
    where: { businessId: mainBusiness.id },
  });

  console.log('Current locations for MI2 Impex:', currentLocations.map(l => `${l.name} (${l.type})`));

  // Ensure Godown exists
  let godown = currentLocations.find(l => l.type === 'GODOWN' || l.name.toLowerCase().includes('godown'));
  if (!godown) {
    console.log('Creating Godown...');
    godown = await prisma.location.create({
      data: {
        businessId: mainBusiness.id,
        name: 'Godown',
        type: 'GODOWN',
        isDefault: true,
        status: 'ACTIVE',
      },
    });
  } else {
    godown = await prisma.location.update({
      where: { id: godown.id },
      data: {
        name: 'Godown',
        type: 'GODOWN',
        isDefault: true,
        status: 'ACTIVE',
      },
    });
  }

  // Ensure Store 1 exists
  const storeCandidates = currentLocations.filter(l => l.id !== godown.id);
  let store1 = storeCandidates.find(l => l.name === 'Store 1') || storeCandidates[0];
  if (!store1) {
    console.log('Creating Store 1...');
    store1 = await prisma.location.create({
      data: {
        businessId: mainBusiness.id,
        name: 'Store 1',
        type: 'STORE',
        status: 'ACTIVE',
      },
    });
  } else {
    store1 = await prisma.location.update({
      where: { id: store1.id },
      data: {
        name: 'Store 1',
        type: 'STORE',
        status: 'ACTIVE',
      },
    });
  }

  // Ensure Store 2 exists
  let store2 = storeCandidates.filter(l => l.id !== store1.id).find(l => l.name === 'Store 2') || storeCandidates.filter(l => l.id !== store1.id)[0];
  if (!store2) {
    console.log('Creating Store 2...');
    store2 = await prisma.location.create({
      data: {
        businessId: mainBusiness.id,
        name: 'Store 2',
        type: 'STORE',
        status: 'ACTIVE',
      },
    });
  } else {
    store2 = await prisma.location.update({
      where: { id: store2.id },
      data: {
        name: 'Store 2',
        type: 'STORE',
        status: 'ACTIVE',
      },
    });
  }

  // Delete any other locations beyond the 1 godown and 2 stores
  const allowedLocationIds = [godown.id, store1.id, store2.id];
  const excessLocations = currentLocations.filter(l => !allowedLocationIds.includes(l.id));
  for (const ex of excessLocations) {
    console.log(`Removing excess location: [${ex.id}] ${ex.name}`);
    // Reassign any products / records to godown before deleting
    await prisma.locationStock.deleteMany({ where: { locationId: ex.id } });
    await prisma.location.delete({ where: { id: ex.id } });
  }

  // Final verification
  const finalBusiness = await prisma.business.findFirst({
    include: {
      locations: true,
      users: { include: { user: true } },
    },
  });

  console.log('\n✅ Successfully updated database:');
  console.log(`Business: "${finalBusiness.name}" (ID: ${finalBusiness.id})`);
  console.log(`Locations (${finalBusiness.locations.length}):`);
  for (const loc of finalBusiness.locations) {
    console.log(`  - [${loc.type}] ${loc.name} (ID: ${loc.id}, Default: ${loc.isDefault})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
