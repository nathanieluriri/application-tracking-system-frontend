"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ButtonLoading } from "@/components/feedback/ButtonLoading";
import { apiFetch, type ApiError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_NEXT = "/dashboard/overview";

// Only allow same-origin relative paths. Rejects absolute URLs, protocol-relative
// ("//evil.com") and backslash-smuggled ("/\\evil.com") values to prevent open redirects.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_NEXT;
  }
  return raw;
}

// Admins and users authenticate against separate endpoints/realms. Try the admin
// realm first; only a 404 (no such admin) falls through to the user realm, so a
// single form works for both. A 401 means the email IS an admin with a wrong
// password — surface that rather than uselessly retrying as a user. Anything else
// (429 rate-limit, 5xx, network) propagates as-is.
async function login(values: FormValues): Promise<void> {
  try {
    await apiFetch(endpoints.auth.adminLogin(), { method: "POST", body: values });
    return;
  } catch (adminErr) {
    if ((adminErr as Partial<ApiError>)?.status !== 404) throw adminErr;
    await apiFetch(endpoints.auth.login(), { method: "POST", body: values });
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await login(values);
      toast.success("Welcome back");
      router.replace(next);
      router.refresh();
    } catch (err) {
      const status = (err as Partial<ApiError>)?.status;
      // 401/404 from either realm just means "wrong account/credentials" — show a
      // single generic message (and avoid leaking which realm the email exists in).
      const message =
        status === 401 || status === 404
          ? "Invalid email or password"
          : err instanceof Error
            ? err.message
            : "Login failed";
      setServerError(message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      <ButtonLoading
        type="submit"
        className="w-full"
        loading={isSubmitting}
        loadingText="Signing in…"
      >
        Sign in
      </ButtonLoading>

      <p className="text-sm text-center text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
