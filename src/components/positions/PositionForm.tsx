"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  positionFormSchema,
  type PositionFormValues,
} from "@/lib/forms/schemas/position";
import {
  useCreatePosition,
  useUpdatePosition,
  type PositionWritePayload,
} from "@/lib/query/hooks/positions";
import {
  POSITION_STATUS_ORDER,
  employmentTypeValues,
  positionStatusConfig,
  employmentTypeLabel,
  getPositionId,
  type EmploymentType,
  type PositionStatus,
  type Position,
} from "@/types/position";

interface PositionFormProps {
  /** Omit for create mode; pass an existing position for edit mode. */
  position?: Position;
}

export function PositionForm({ position }: PositionFormProps) {
  const router = useRouter();
  const isEdit = Boolean(position);
  const id = position ? getPositionId(position) : "";

  const create = useCreatePosition();
  const update = useUpdatePosition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PositionFormValues>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: {
      title: position?.title ?? "",
      department: position?.department ?? "",
      location: position?.location ?? "",
      employment_type: (position?.employment_type as EmploymentType) ?? "full_time",
      status: (position?.status as PositionStatus) ?? "open",
      description: position?.description ?? "",
      requirements: (position?.requirements ?? []).map((value) => ({ value })),
      process_template_id: position?.process_template_id ?? "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "requirements" });

  // Warn before navigating away with unsaved changes.
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

  const currentType = watch("employment_type");
  const currentStatus = watch("status");

  async function onSubmit(values: PositionFormValues) {
    setServerError(null);
    const payload: PositionWritePayload = {
      title: values.title,
      department: values.department?.trim() ? values.department.trim() : null,
      location: values.location?.trim() ? values.location.trim() : null,
      employment_type: values.employment_type,
      status: values.status,
      description: values.description?.trim() ? values.description : null,
      requirements: (values.requirements ?? [])
        .map((r) => r.value.trim())
        .filter(Boolean),
      process_template_id: values.process_template_id?.trim()
        ? values.process_template_id.trim()
        : null,
    };

    try {
      if (isEdit) {
        await update.mutateAsync({ id, patch: payload });
        toast.success("Position updated");
        router.push(`/dashboard/positions/${id}`);
      } else {
        const created = await create.mutateAsync(payload);
        toast.success(`"${created.title}" created`);
        router.push(`/dashboard/positions/${getPositionId(created)}`);
      }
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" aria-invalid={!!errors.title} {...register("title")} />
        {errors.title ? (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input id="department" {...register("department")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" placeholder="e.g. Remote, London" {...register("location")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employment_type">Employment type</Label>
          <Select
            value={currentType}
            onValueChange={(v) =>
              setValue("employment_type", v as EmploymentType, { shouldDirty: true })
            }
          >
            <SelectTrigger id="employment_type" aria-invalid={!!errors.employment_type}>
              <SelectValue placeholder="Pick a type" />
            </SelectTrigger>
            <SelectContent>
              {employmentTypeValues.map((t) => (
                <SelectItem key={t} value={t}>
                  {employmentTypeLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.employment_type ? (
            <p className="text-xs text-destructive">{errors.employment_type.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={currentStatus}
            onValueChange={(v) =>
              setValue("status", v as PositionStatus, { shouldDirty: true })
            }
          >
            <SelectTrigger id="status" aria-invalid={!!errors.status}>
              <SelectValue placeholder="Pick a status" />
            </SelectTrigger>
            <SelectContent>
              {POSITION_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {positionStatusConfig(s).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status ? (
            <p className="text-xs text-destructive">{errors.status.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={5}
          placeholder="What the role is about, the team, day-to-day…"
          {...register("description")}
        />
      </div>

      <div className="space-y-2">
        <Label>Requirements</Label>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <Input
                {...register(`requirements.${index}.value` as const)}
                placeholder={`Requirement ${index + 1}`}
                aria-label={`Requirement ${index + 1}`}
                aria-invalid={!!errors.requirements?.[index]?.value}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label={`Remove requirement ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ value: "" })}
          >
            <Plus className="mr-2 h-4 w-4" /> Add requirement
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" asChild>
          <Link href={isEdit ? `/dashboard/positions/${id}` : "/dashboard/positions"}>
            Cancel
          </Link>
        </Button>
        <ButtonLoading
          type="submit"
          loading={isSubmitting}
          loadingText={isEdit ? "Saving…" : "Creating…"}
          disabled={isEdit && !isDirty}
        >
          {isEdit ? "Save changes" : "Create position"}
        </ButtonLoading>
      </div>
    </form>
  );
}
