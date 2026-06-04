import { ObjectId } from "mongodb";

/** A fresh, valid Mongo ObjectId hex string (used for user/admin ids). */
export function newId(): string {
  return new ObjectId().toHexString();
}

export function toObjectId(id: string): ObjectId {
  return new ObjectId(id);
}
