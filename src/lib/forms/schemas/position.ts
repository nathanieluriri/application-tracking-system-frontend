import { z } from "zod";
import {
  positionStatusValues,
  employmentTypeValues,
} from "@/types/position";

/**
 * Single form schema used by both the create and edit position forms.
 * `requirements` is modelled as `{ value }[]` so react-hook-form's
 * `useFieldArray` can manage it; the form flattens it to `string[]` on submit.
 */
export const positionFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  department: z.string().max(100, "Too long").optional(),
  location: z.string().max(200, "Too long").optional(),
  employment_type: z.enum(employmentTypeValues, {
    message: "Pick a valid employment type",
  }),
  status: z.enum(positionStatusValues, { message: "Pick a valid status" }),
  description: z.string().max(5000, "Description is too long").optional(),
  requirements: z
    .array(z.object({ value: z.string().min(1, "Requirement cannot be empty") }))
    .optional(),
  process_template_id: z.string().max(100).optional(),
});

export type PositionFormValues = z.infer<typeof positionFormSchema>;
