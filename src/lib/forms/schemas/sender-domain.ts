import { z } from "zod";

// A pragmatic domain check: at least one dot, no protocol/spaces, no @.
const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export const senderDomainCreateSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, "Enter a domain")
    .max(253, "Domain is too long")
    .regex(DOMAIN_RE, "Enter a bare domain like send.acme.com (no https:// or @)"),
  region: z.enum(["us-east-1", "eu-west-1", "sa-east-1", "ap-northeast-1"], {
    message: "Pick a region",
  }),
});

export type SenderDomainCreateValues = z.infer<typeof senderDomainCreateSchema>;
