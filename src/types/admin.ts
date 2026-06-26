export type AdminAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

/** An admin account as returned by `GET /api/admins` (password always omitted). */
export interface Admin {
  id: string | null;
  full_name: string;
  email: string;
  accountStatus: AdminAccountStatus;
  invited_by: string | null;
  date_created: number | null;
  last_updated: number | null;
}

export function getAdminId(admin: Admin): string {
  return admin.id ?? "";
}
