/**
 * Authenticated principal, mirrors `security/principal.py`.
 */

export type Role = "user" | "admin";

export interface PrincipalInit {
  userId: string;
  role: Role;
  accessTokenId: string;
  jwtToken: string;
  allowExpired?: boolean;
}

export interface AuthPrincipal {
  userId: string;
  role: Role;
  accessTokenId: string;
  jwtToken: string;
  allowExpired: boolean;
  readonly isAdmin: boolean;
  readonly isUser: boolean;
}

export function makePrincipal(init: PrincipalInit): AuthPrincipal {
  const role = init.role;
  return {
    userId: init.userId,
    role,
    accessTokenId: init.accessTokenId,
    jwtToken: init.jwtToken,
    allowExpired: init.allowExpired ?? false,
    isAdmin: role === "admin",
    isUser: role === "user",
  };
}
