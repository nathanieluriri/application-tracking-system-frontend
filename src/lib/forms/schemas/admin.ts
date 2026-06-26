import { z } from "zod";

/**
 * Create-admin form schema. The backend (`adminSignupSchema`) only requires
 * `{ full_name, email, password }`; the confirm field is a client-side guard so
 * a typo'd password can't lock the new admin out. New admins default to full
 * dashboard permissions server-side.
 */
export const adminCreateFormSchema = z
  .object({
    full_name: z.string().min(1, "Full name is required").max(200, "Too long"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(200, "Too long"),
    confirmPassword: z.string().min(1, "Confirm the password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type AdminCreateFormValues = z.infer<typeof adminCreateFormSchema>;
