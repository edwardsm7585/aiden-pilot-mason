"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Separator,
  Textarea,
} from "@upstart13-com/aiden-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Mirrors the editable fields of UpdateTicketBody (src/lib/schemas.ts). */
const EditSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Enter a subject")
    .max(200, "Keep the subject under 200 characters"),
  body: z.string().trim().min(1, "Enter the customer’s message").max(10_000),
  status: z.enum(["open", "pending"]),
});
type Values = z.infer<typeof EditSchema>;

interface TicketActionsProps {
  ticket: { id: string; subject: string; body: string; status: string };
  canClose: boolean;
}

export function TicketActions({ ticket, canClose }: TicketActionsProps) {
  const router = useRouter();
  const closed = ticket.status === "closed";
  const [statusBusy, setStatusBusy] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(EditSchema),
    defaultValues: {
      subject: ticket.subject,
      body: ticket.body,
      status: closed ? "open" : (ticket.status as Values["status"]),
    },
  });

  async function send(
    url: string,
    init: RequestInit,
    action: string
  ): Promise<Response | null> {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      toast.error(`Couldn’t ${action}`, {
        description:
          res.status === 403
            ? "Your role can’t change this ticket."
            : res.status === 404
              ? "This ticket no longer exists or isn’t yours to change."
              : "The server returned an error. Try again in a moment.",
      });
    } catch {
      toast.error(`Couldn’t ${action}`, {
        description:
          "The request didn’t reach the server. Check your connection.",
      });
    }
    return null;
  }

  async function onSubmit(values: Values) {
    const dirty = form.formState.dirtyFields;
    const changed = Object.fromEntries(
      (Object.keys(values) as (keyof Values)[])
        .filter((k) => dirty[k])
        .map((k) => [k, values[k]])
    );
    const res = await send(
      `/api/tickets/${ticket.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      },
      "save changes"
    );
    if (!res) return;
    toast.success("Changes saved", {
      description:
        "subject" in changed || "body" in changed
          ? "AI re-triaged the ticket from the new text."
          : "The ticket status was updated.",
    });
    form.reset(values);
    router.refresh();
  }

  async function setClosed(close: boolean) {
    setStatusBusy(true);
    const res = close
      ? await send(
          `/api/tickets/${ticket.id}/close`,
          { method: "POST" },
          "close the ticket"
        )
      : await send(
          `/api/tickets/${ticket.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "open" }),
          },
          "reopen the ticket"
        );
    setStatusBusy(false);
    if (!res) return;
    toast.success(close ? "Ticket closed" : "Ticket reopened", {
      description: close
        ? "It moves to the Closed filter. You can reopen it here."
        : "It’s back in the Open queue.",
    });
    router.refresh();
  }

  const submitting = form.formState.isSubmitting;
  const dirty = form.formState.isDirty;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit ticket</CardTitle>
        <CardDescription>
          Changing the subject or message re-runs AI triage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {closed ? (
          <p className="text-muted-foreground text-sm">
            This ticket is closed. Reopen it to make changes.
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input maxLength={200} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer message</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[120px] resize-y" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Use Pending while you wait on the customer.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-end gap-3">
                {!dirty && (
                  <span className="text-muted-foreground text-xs">
                    Edit a field to save
                  </span>
                )}
                <Button type="submit" disabled={!dirty || submitting}>
                  {submitting ? (
                    <>
                      <Loader2
                        className="mr-2 size-4 animate-spin"
                        strokeWidth={1.5}
                      />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {canClose && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-xs">
                {closed
                  ? "Reopening puts it back in the Open queue."
                  : "Close it once the customer’s issue is resolved."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={statusBusy}
                onClick={() => setClosed(!closed)}
              >
                {statusBusy && (
                  <Loader2
                    className="mr-2 size-4 animate-spin"
                    strokeWidth={1.5}
                  />
                )}
                {closed ? "Reopen ticket" : "Close ticket"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
