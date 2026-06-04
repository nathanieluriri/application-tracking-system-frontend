"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ButtonLoading } from "@/components/feedback/ButtonLoading";
import {
  applicantEditSchema,
  type ApplicantEditValues,
} from "@/lib/forms/schemas/applicant";
import { useUpdateApplicant } from "@/lib/query/hooks/applicants";
import { STATUS_ORDER, statusConfig, type Applicant } from "@/types/applicant";

interface ApplicantEditFormProps {
  applicant: Applicant;
}

export function ApplicantEditForm({ applicant }: ApplicantEditFormProps) {
  const router = useRouter();
  const update = useUpdateApplicant();
  const [serverError, setServerError] = useState<string | null>(null);
  const id = applicant.id ?? applicant._id ?? "";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ApplicantEditValues>({
    resolver: zodResolver(applicantEditSchema),
    defaultValues: {
      status: applicant.status as ApplicantEditValues["status"],
      rating: applicant.rating ?? 0,
      notes: applicant.notes ?? "",
    },
  });

  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const currentStatus = watch("status");
  const currentRating = watch("rating");

  async function onSubmit(values: ApplicantEditValues) {
    setServerError(null);
    try {
      await update.mutateAsync({ id, patch: values });
      toast.success("Applicant updated");
      router.push(`/dashboard/applicants/${id}`);
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={currentStatus}
            onValueChange={(v) =>
              setValue("status", v as ApplicantEditValues["status"], {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger id="status" aria-invalid={!!errors.status}>
              <SelectValue placeholder="Pick a status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusConfig(s).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status ? (
            <p className="text-xs text-destructive">{errors.status.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="rating">Rating</Label>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                aria-checked={currentRating === n}
                role="radio"
                onClick={() =>
                  setValue("rating", n === currentRating ? 0 : n, {
                    shouldDirty: true,
                  })
                }
                className="text-2xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <span className={n <= currentRating ? "text-amber-500" : "text-muted-foreground/40"}>
                  ★
                </span>
              </button>
            ))}
            <span className="ml-2 text-xs text-muted-foreground">
              {currentRating ? `${currentRating}/5` : "Not rated"}
            </span>
          </div>
          {errors.rating ? (
            <p className="text-xs text-destructive">{errors.rating.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={6}
          placeholder="Interview impressions, follow-up reminders, internal context…"
          aria-invalid={!!errors.notes}
          {...register("notes")}
        />
        {errors.notes ? (
          <p className="text-xs text-destructive">{errors.notes.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Internal only — not visible to the applicant.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" asChild>
          <Link href={`/dashboard/applicants/${id}`}>Cancel</Link>
        </Button>
        <ButtonLoading
          type="submit"
          loading={isSubmitting}
          loadingText="Saving…"
          disabled={!isDirty}
        >
          Save changes
        </ButtonLoading>
      </div>
    </form>
  );
}
