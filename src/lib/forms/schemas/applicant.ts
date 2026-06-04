import { z } from "zod";
import { STATUS_ORDER } from "@/types/applicant";

const statusEnum = z.enum(
  STATUS_ORDER as unknown as [string, ...string[]],
  { message: "Pick a valid status" },
);

export const applicantEditSchema = z.object({
  status: statusEnum,
  rating: z
    .number({ message: "Rating must be a number" })
    .int("Rating must be a whole number")
    .min(0, "Rating cannot be less than 0")
    .max(5, "Rating cannot be more than 5"),
  notes: z.string().max(2000, "Notes are too long (max 2000 characters)"),
});

export type ApplicantEditValues = z.infer<typeof applicantEditSchema>;

export const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one applicant"),
  status: statusEnum,
});

export type BulkStatusValues = z.infer<typeof bulkStatusSchema>;
