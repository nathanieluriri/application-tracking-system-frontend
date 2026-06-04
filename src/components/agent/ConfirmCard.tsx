"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ButtonLoading } from "@/components/feedback/ButtonLoading";

interface ConfirmCardProps {
  preview: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmCard({
  preview,
  pending,
  onConfirm,
  onCancel,
}: ConfirmCardProps) {
  return (
    <Card className="border-primary/40 bg-muted/40">
      <CardContent className="p-4 pt-4">
        <p className="text-sm text-foreground whitespace-pre-wrap">{preview}</p>
      </CardContent>
      <CardFooter className="gap-2 p-4 pt-0">
        <ButtonLoading
          type="button"
          size="sm"
          loading={pending}
          loadingText="Confirming…"
          onClick={onConfirm}
        >
          Confirm
        </ButtonLoading>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
