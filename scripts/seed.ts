/**
 * Seed entrypoint: `bun run seed`.
 * Loads .env.local, creates a super admin, prints the credentials to use.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const email = process.env.SUPER_ADMIN_EMAIL || "admin@ats.local";
const password = process.env.SUPER_ADMIN_PASSWORD || "admin12345";

const { seedSuperAdmin } = await import("../src/server/seed");
const { closeDb } = await import("../src/server/core/database");

const result = await seedSuperAdmin(email, password);
if (result.created) {
  // eslint-disable-next-line no-console
  console.log(`✓ Seeded super admin\n  email:    ${email}\n  password: ${password}\n  id:       ${result.id}`);
} else {
  // eslint-disable-next-line no-console
  console.log(`• Super admin already exists (${email}, id ${result.id})`);
}
await closeDb();
