import type { ListQuery } from "@/lib/api/endpoints";

export const qk = {
  auth: {
    me: ["auth", "me"] as const,
  },
  applicants: {
    all: ["applicants"] as const,
    list: (q: ListQuery) => ["applicants", "list", q] as const,
    detail: (id: string) => ["applicants", "detail", id] as const,
  },
  positions: {
    all: ["positions"] as const,
    list: (q: ListQuery) => ["positions", "list", q] as const,
    detail: (id: string) => ["positions", "detail", id] as const,
  },
  emailTemplates: {
    all: ["email-templates"] as const,
    list: (q: ListQuery) => ["email-templates", "list", q] as const,
    detail: (id: string) => ["email-templates", "detail", id] as const,
  },
  emails: {
    list: (q: ListQuery) => ["emails", "list", q] as const,
    stats: ["emails", "stats"] as const,
  },
  dashboard: {
    overview: ["dashboard", "overview"] as const,
  },
  settings: ["settings"] as const,
  senderDomains: {
    all: ["sender-domains"] as const,
    detail: (id: string) => ["sender-domains", "detail", id] as const,
  },
  widgets: {
    all: ["widgets"] as const,
    detail: (id: string) => ["widgets", "detail", id] as const,
  },
} as const;
