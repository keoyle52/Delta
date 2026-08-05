import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Cleaning old execution records...');
  const deleted = await prisma.execution.deleteMany({});
  console.log(`Deleted ${deleted.count} old execution logs from database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
