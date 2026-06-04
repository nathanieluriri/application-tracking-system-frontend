"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ButtonLoading } from "@/components/feedback/ButtonLoading";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  senderDomainCreateSchema,
  type SenderDomainCreateValues,
} from "@/lib/forms/schemas/sender-domain";
import {
  useCreateSenderDomain,
  useDeleteSenderDomain,
  useRefreshSenderDomain,
  useSenderDomains,
  useVerifySenderDomain,
} from "@/lib/query/hooks/sender-domains";
import {
  SENDER_DOMAIN_REGIONS,
  SENDER_DOMAIN_STATUS_CONFIG,
  domainId,
  type DnsRecord,
  type SenderDomain,
} from "@/types/sender-domain";

function StatusPill({ status }: { status: SenderDomain["status"] }) {
  const cfg = SENDER_DOMAIN_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        cfg.badgeClass,
      )}
    >
      {cfg.label}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      aria-label="Copy value"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("Couldn't copy to clipboard");
        }
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function DnsRecordsTable({ records }: { records: DnsRecord[] }) {
  if (!records.length) return null;
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Type</TableHead>
            <TableHead>Name / Host</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="w-20">Priority</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r, i) => (
            <TableRow key={`${r.type}-${r.name}-${i}`}>
              <TableCell className="font-mono text-xs">{r.type}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <code className="max-w-[14rem] truncate text-xs">{r.name}</code>
                  {r.name ? <CopyButton value={r.name} /> : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <code className="max-w-[20rem] truncate text-xs">{r.value}</code>
                  {r.value ? <CopyButton value={r.value} /> : null}
                </div>
              </TableCell>
              <TableCell className="text-xs">{r.priority ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DomainRow({ domain }: { domain: SenderDomain }) {
  const id = domainId(domain);
  const verify = useVerifySenderDomain();
  const refresh = useRefreshSenderDomain();
  const remove = useDeleteSenderDomain();
  const isVerified = domain.status === "verified";

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{domain.domain}</span>
          <StatusPill status={domain.status} />
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${domain.domain}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {domain.domain}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the domain from Resend too. Emails will fall back to the
                default sender until you add and verify a domain again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  remove.mutate(id, {
                    onSuccess: () => toast.success(`${domain.domain} removed`),
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {isVerified ? (
        <p className="text-sm text-muted-foreground">
          You&apos;re sending from <code className="text-xs">{domain.domain}</code>. No
          further action needed.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Add these records at your DNS provider (Cloudflare, GoDaddy, etc.), then click
            Verify. DNS changes can take a few minutes to a few hours to propagate.
          </p>
          <DnsRecordsTable records={domain.dns_records} />
          <div className="flex items-center gap-2">
            <ButtonLoading
              type="button"
              size="sm"
              loading={verify.isPending}
              loadingText="Verifying…"
              onClick={() =>
                verify.mutate(id, {
                  onSuccess: (d) =>
                    d.status === "verified"
                      ? toast.success(`${d.domain} verified`)
                      : toast.info("Not verified yet — DNS may still be propagating"),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Verify
            </ButtonLoading>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={refresh.isPending}
              onClick={() =>
                refresh.mutate(id, { onError: (e) => toast.error(e.message) })
              }
            >
              <RefreshCw
                className={cn("mr-2 h-3.5 w-3.5", refresh.isPending && "animate-spin")}
              />
              Refresh status
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function AddDomainForm() {
  const create = useCreateSenderDomain();
  const form = useForm<SenderDomainCreateValues>({
    resolver: zodResolver(senderDomainCreateSchema),
    defaultValues: { domain: "", region: "us-east-1" },
  });

  function onSubmit(values: SenderDomainCreateValues) {
    create.mutate(values, {
      onSuccess: (d) => {
        toast.success(`${d.domain} added — now add the DNS records below`);
        form.reset({ domain: "", region: values.region });
      },
      onError: (e) => toast.error(e.message),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Sending domain</FormLabel>
              <FormControl>
                <Input placeholder="send.acme.com" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem className="sm:w-56">
              <FormLabel>Region</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SENDER_DOMAIN_REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <ButtonLoading
          type="submit"
          className="sm:mt-8"
          loading={create.isPending}
          loadingText="Adding…"
        >
          Add domain
        </ButtonLoading>
      </form>
    </Form>
  );
}

export function SendingDomains() {
  const { data: domains, isLoading, isError, error } = useSenderDomains();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sending domains</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Send candidate emails from your own domain. Add a domain, drop the DNS records
          into your provider, and verify — no Resend account or API key needed on your
          side. Until a domain is verified, emails go out from the default sender.
        </p>

        <AddDomainForm />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading domains…</p>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {(error as Error)?.message ?? "Couldn't load sending domains."}
            </AlertDescription>
          </Alert>
        ) : !domains?.length ? (
          <p className="text-sm text-muted-foreground">
            No sending domains yet. Add one above to send from your own address.
          </p>
        ) : (
          <div className="space-y-3">
            {domains.map((d) => (
              <DomainRow key={domainId(d)} domain={d} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
