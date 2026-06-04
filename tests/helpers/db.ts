import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";

let mongod: MongoMemoryServer | null = null;
let client: MongoClient | null = null;

const TEST_DB_NAME = "ats_test";

/**
 * Boot an in-memory MongoDB and point the @server database singleton at it by
 * setting MONGODB_URI / DB_NAME before any repository connects. Returns a Db
 * handle for direct test setup/inspection.
 */
export async function startTestDb(): Promise<Db> {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.DB_NAME = TEST_DB_NAME;
  client = new MongoClient(uri);
  await client.connect();
  return client.db(TEST_DB_NAME);
}

export async function stopTestDb(): Promise<void> {
  await client?.close();
  await mongod?.stop();
  client = null;
  mongod = null;
}

/** Remove all documents from every collection between tests. */
export async function clearDb(db: Db): Promise<void> {
  const cols = await db.collections();
  await Promise.all(cols.map((c) => c.deleteMany({})));
}
