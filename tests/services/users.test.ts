import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { addUser, authenticateUser, refreshUserTokens } from "@server/services/users";
import { LoginType } from "@server/schemas/common";
import { decodeToken } from "@server/security/jwt";

const signup = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "pw123456",
  loginType: LoginType.email,
};

describe("user service", () => {
  let db: Db;
  beforeAll(async () => {
    db = await startTestDb();
  });
  afterEach(async () => {
    await clearDb(db);
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("signs up a user, returns tokens, and hides the password", async () => {
    const user = await addUser(signup);
    expect(user.id).toBeTruthy();
    expect(user.access_token).toBeTruthy();
    expect(user.refresh_token).toBeTruthy();
    expect(user.password).toBeNull();
  });

  it("rejects a duplicate email with 409", async () => {
    await addUser(signup);
    await expect(addUser(signup)).rejects.toMatchObject({ status: 409 });
  });

  it("authenticates with the correct password and rejects a wrong one", async () => {
    await addUser(signup);
    const ok = await authenticateUser({ email: signup.email, password: signup.password });
    expect(ok.access_token).toBeTruthy();
    await expect(
      authenticateUser({ email: signup.email, password: "wrong" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("404s for an unknown user", async () => {
    await expect(
      authenticateUser({ email: "nobody@example.com", password: "x" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rotates tokens on refresh with a matching access record", async () => {
    const user = await addUser(signup);
    const claims = await decodeToken(user.access_token!);
    const accessRecordId = String(claims!.accessToken);
    const refreshed = await refreshUserTokens(user.refresh_token!, accessRecordId);
    expect(refreshed.access_token).toBeTruthy();
    expect(refreshed.access_token).not.toBe(user.access_token);
  });

  it("rejects refresh with an unknown refresh token", async () => {
    await expect(refreshUserTokens("000000000000000000000000", "x")).rejects.toMatchObject({
      status: 404,
    });
  });
});
