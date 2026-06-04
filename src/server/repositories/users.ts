import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { userOut, type UserDoc, type UserOut } from "@server/schemas/users";
import { nowSeconds } from "@server/schemas/common";

/**
 * User persistence, mirrors `repositories/user_repo.py`.
 */

export async function createUser(doc: UserDoc): Promise<UserOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.users).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.users).findOne({ _id: res.insertedId });
  return userOut(stored!);
}

export async function getUser(filter: Filter<Document>): Promise<UserOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.users).findOne(filter);
  return result ? userOut(result) : null;
}

export async function getUsers(start = 0, stop = 100): Promise<UserOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.users)
    .find({})
    .skip(start)
    .limit(stop - start);
  const items: UserOut[] = [];
  for await (const doc of cursor) {
    const u = userOut(doc);
    u.password = null;
    items.push(u);
  }
  return items;
}

export async function updateUser(
  filter: Filter<Document>,
  data: Record<string, unknown>,
): Promise<UserOut | null> {
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.users)
    .findOneAndUpdate(
      filter,
      { $set: { ...data, last_updated: nowSeconds() } },
      { returnDocument: "after" },
    );
  return result ? userOut(result) : null;
}

export async function deleteUser(filter: Filter<Document>): Promise<{ deletedCount: number }> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.users).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}
