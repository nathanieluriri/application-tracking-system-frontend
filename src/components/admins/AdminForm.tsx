"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ButtonLoading } from "@/components/feedback/ButtonLoading";
import {
  adminCreateFormSchema,
  type AdminCreateFormValues,
} from "@/lib/forms/schemas/admin";
import { useCreateAdmin } from "@/lib/query/hooks/admins";

export function AdminForm() {
  const router = useRouter();
  const create = useCreateAdmin();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminCreateFormValues>({
    resolver: zodResolver(adminCreateFormSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: AdminCreateFormValues) {
    setServerError(null);
    try {
      const created = await create.mutateAsync({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
      });
      toast.success(`Admin "${created.full_name}" created`);
      router.push("/dashboard/admins");
      router.refresh();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        // Duplicate email — surface it on the field, not as a banner.
        setError("email", {
          message: "An admin with this email already exists",
        });
        return;
      }
      setServerError(err instanceof Error ? err.message : "Could not create admin");
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
        <Label htmlFor="full_name">Full name *</Label>
        <Input
          id="full_name"
          autoComplete="name"
          aria-invalid={!!errors.full_name}
          {...register("full_name")}
        />
        {errors.full_name ? (
          <p className="text-xs text-destructive">{errors.full_name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Temporary password *</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password *</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        The new admin gets full dashboard access. Share these credentials
        securely — they can change their password after signing in.
      </p>

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/admins">Cancel</Link>
        </Button>
        <ButtonLoading
          type="submit"
          loading={isSubmitting}
          loadingText="Creating…"
        >
          Create admin
        </ButtonLoading>
      </div>
    </form>
  );
}
