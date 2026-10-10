import { database } from "./runtime";
import { articles, freshness, trendList, seedDatabase } from "./store";
let initialized = false;
export async function readyDatabase() {
  const db = database();
  if (!initialized) {
    await seedDatabase(db);
    initialized = true;
  }
  return db;
}
export async function newsroom() {
  try {
    const db = await readyDatabase();
    return {
      items: await articles(db),
      trends: await trendList(db),
      freshness: await freshness(db),
      database: true,
    };
  } catch {
    return {
      items: await articles(),
      trends: await trendList(),
      freshness: { lastSuccess: null, stale: true },
      database: false,
    };
  }
}
