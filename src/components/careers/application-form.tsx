"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { applicationSchema, type ApplicationFormValues } from "@/lib/forms/schemas/application";

const fieldClass =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-400/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-emerald-400/15";

export function ApplicationForm({
  positionId,
  roleTitle,
}: {
  positionId: string;
  roleTitle: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues>({ resolver: zodResolver(applicationSchema) });

  async function onSubmit(values: ApplicationFormValues) {
    setFormError(null);
    const el = formRef.current;
    const fd = new FormData();
    fd.append("position_id", positionId);
    fd.append("full_name", values.full_name);
    fd.append("email", values.email);
    if (values.phone) fd.append("phone", values.phone);
    if (values.location) fd.append("location", values.location);
    if (values.experience) fd.append("experience", values.experience);

    const website = (el?.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
    fd.append("website", website); // honeypot — must stay empty
    const cvInput = el?.elements.namedItem("cv") as HTMLInputElement | null;
    if (cvInput?.files?.[0]) fd.append("cv", cvInput.files[0]);

    let res: Response;
    try {
      res = await fetch("/api/applications", { method: "POST", body: fd });
    } catch {
      setFormError("Network error — please check your connection and try again.");
      return;
    }

    let body: { message?: string; data?: { details?: { errors?: Array<{ path?: unknown; message?: string }> } } } | null = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (res.ok) {
      setSubmitted(true);
      return;
    }
    if (res.status === 422 && body?.data?.details?.errors) {
      for (const issue of body.data.details.errors) {
        const field = Array.isArray(issue.path) ? issue.path[0] : issue.path;
        if (typeof field === "string" && field in ({ full_name: 1, email: 1, phone: 1, location: 1, experience: 1 } as Record<string, number>)) {
          setError(field as keyof ApplicationFormValues, { message: issue.message });
        }
      }
      setFormError("Please correct the highlighted fields.");
      return;
    }
    if (res.status === 429) {
      setFormError("It looks like you've already applied recently. Please try again later.");
      return;
    }
    if (res.status === 403) {
      setFormError("Submissions from your network are temporarily blocked.");
      return;
    }
    setFormError(body?.message ?? "Something went wrong submitting your application.");
  }

  if (submitted) {
    return (
      <div className="animate-in fade-in zoom-in-95 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-8 text-center duration-500">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
          ✓
        </div>
        <h3 className="mt-4 font-[family-name:var(--font-fraunces)] text-xl text-zinc-50">
          Application received
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
          Thanks for applying for <span className="text-zinc-200">{roleTitle}</span>. We&apos;ll be
          in touch if it&apos;s a match.
        </p>
        <Link
          href="/careers"
          className="mt-6 inline-block text-sm text-emerald-400 underline-offset-4 hover:underline"
        >
          Browse other roles →
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Honeypot — visually hidden, off the tab order. Bots fill it; humans don't. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required error={errors.full_name?.message}>
          <input className={fieldClass} placeholder="Ada Lovelace" {...register("full_name")} />
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          <input className={fieldClass} type="email" placeholder="you@example.com" {...register("email")} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <input className={fieldClass} placeholder="Optional" {...register("phone")} />
        </Field>
        <Field label="Location" error={errors.location?.message}>
          <input className={fieldClass} placeholder="City, Country" {...register("location")} />
        </Field>
      </div>

      <Field label="Anything else?" error={errors.experience?.message}>
        <textarea
          className={`${fieldClass} min-h-[110px] resize-y`}
          placeholder="A few lines about your experience…"
          {...register("experience")}
        />
      </Field>

      <Field label="Résumé / CV">
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3.5 py-3 text-sm text-zinc-400 transition hover:border-emerald-400/40 hover:text-zinc-200">
          <span className="truncate">{cvName ?? "Attach a PDF or Word document"}</span>
          <span className="ml-3 shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-300">
            Browse
          </span>
          <input
            type="file"
            name="cv"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => setCvName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
      </Field>

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3.5 py-2.5 text-sm text-red-300"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isSubmitting && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-950/30 border-t-emerald-950" />
        )}
        {isSubmitting ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-zinc-300">
        {label}
        {required && <span className="ml-0.5 text-emerald-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
