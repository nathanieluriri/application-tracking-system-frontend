function qs(params: object): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of entries) {
    if (Array.isArray(v)) {
      for (const item of v) sp.append(k, String(item));
    } else {
      sp.set(k, String(v));
    }
  }
  return `?${sp.toString()}`;
}

export interface ListQuery {
  start?: number;
  stop?: number;
  status?: string;
  position_id?: string;
  search?: string;
  department?: string;
}

export const endpoints = {
  auth: {
    me: () => `/api/auth/me`,
    login: () => `/api/auth/login`,
    signup: () => `/api/auth/signup`,
    logout: () => `/api/auth/logout`,
    refresh: () => `/api/auth/refresh`,
  },
  applications: {
    list: (q: ListQuery = {}) => `/api/applications/${qs(q)}`,
    get: (id: string) => `/api/applications/${id}`,
    update: (id: string) => `/api/applications/${id}`,
    remove: (id: string) => `/api/applications/${id}`,
    bulkStatus: () => `/api/applications/bulk/status`,
    cv: (id: string) => `/api/applications/${id}/cv`,
  },
  positions: {
    list: (q: ListQuery = {}) => `/api/positions/${qs(q)}`,
    public: (q: ListQuery = {}) => `/api/positions/public${qs(q)}`,
    get: (id: string) => `/api/positions/${id}`,
    create: () => `/api/positions/`,
    update: (id: string) => `/api/positions/${id}`,
    close: (id: string) => `/api/positions/${id}/close`,
    remove: (id: string) => `/api/positions/${id}`,
  },
  emailTemplates: {
    list: (q: ListQuery = {}) => `/api/email-templates/${qs(q)}`,
    get: (id: string) => `/api/email-templates/${id}`,
    create: () => `/api/email-templates/`,
    update: (id: string) => `/api/email-templates/${id}`,
    remove: (id: string) => `/api/email-templates/${id}`,
  },
  emails: {
    list: (q: ListQuery = {}) => `/api/emails/${qs(q)}`,
    stats: () => `/api/emails/stats`,
    compose: () => `/api/emails/compose`,
  },
  invitations: {
    list: (q: ListQuery = {}) => `/api/invitations/${qs(q)}`,
    create: () => `/api/invitations/`,
    revoke: (id: string) => `/api/invitations/${id}/revoke`,
    resend: (id: string) => `/api/invitations/${id}/resend`,
    verify: (token: string) => `/api/invitations/verify?token=${encodeURIComponent(token)}`,
    accept: () => `/api/invitations/accept`,
  },
  applicationProcesses: {
    list: () => `/api/application-processes/`,
    get: (id: string) => `/api/application-processes/${id}`,
    create: () => `/api/application-processes/`,
    update: (id: string) => `/api/application-processes/${id}`,
    remove: (id: string) => `/api/application-processes/${id}`,
    forPosition: (positionId: string) =>
      `/api/application-processes/positions/${positionId}/process`,
  },
  settings: {
    get: () => `/api/settings/`,
    update: () => `/api/settings/`,
  },
  senderDomains: {
    list: () => `/api/sender-domains/`,
    create: () => `/api/sender-domains/`,
    get: (id: string) => `/api/sender-domains/${id}`,
    verify: (id: string) => `/api/sender-domains/${id}/verify`,
    remove: (id: string) => `/api/sender-domains/${id}`,
  },
  widgets: {
    list: () => `/api/widgets/`,
    get: (id: string) => `/api/widgets/${id}`,
    create: () => `/api/widgets/`,
    update: (id: string) => `/api/widgets/${id}`,
    duplicate: (id: string) => `/api/widgets/${id}/duplicate`,
    remove: (id: string) => `/api/widgets/${id}`,
    publicData: (id: string) => `/api/public/widgets/${id}`,
  },
  dashboard: {
    overview: (forceRefresh = false) =>
      `/api/dashboard/overview${forceRefresh ? "?force_refresh=true" : ""}`,
  },
} as const;
