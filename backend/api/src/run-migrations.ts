import dataSource from './data-source';

async function main() {
  const revert = process.argv.includes('revert');
  await dataSource.initialize();
  try {
    if (revert) {
      await dataSource.undoLastMigration();
      console.log('Reverted last migration');
    } else {
      const ran = await dataSource.runMigrations();
      if (ran.length === 0) {
        console.log('No pending migrations');
      } else {
        for (const migration of ran) {
          console.log(`Ran ${migration.name}`);
        }
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
