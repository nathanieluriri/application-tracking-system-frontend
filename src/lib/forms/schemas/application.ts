import { z } from "zod";

/**
 * Public job-application form. The CV file + the `website` honeypot are handled
 * directly on the FormData in the form component (not part of the typed values).
 */
export const applicationSchema = z.object({
  full_name: z.string().trim().min(1, "Please enter your name"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().optional(),
  location: z.string().trim().optional(),
  experience: z.string().trim().optional(),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;
