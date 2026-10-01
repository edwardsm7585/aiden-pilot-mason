"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@upstart13-com/aiden-ui";
import { CreateTicketBody } from "@/lib/schemas";

type Values = z.input<typeof CreateTicketBody>;

/** Response shape of POST /api/tickets (see src/app/api/tickets/route.ts). */
type CreateResponse = {
  ticket: { id: string; priority: string | null };
};
type ErrorResponse = {
  error?: { fieldErrors?: Partial<Record<keyof Values, string[]>> } | string;
};

export function NewTicketForm() {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(CreateTicketBody),
    defaultValues: { subject: "", body: "" },
  });

  async function onSubmit(values: Values) {
    let res: Response;
    try {
      res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      toast.error("Couldn’t create the ticket", {
        description:
          "The request didn’t reach the server. Check your connection and try again.",
      });
      return;
    }

    if (res.status === 201) {
      const { ticket } = (await res.json()) as CreateResponse;
      toast.success("Ticket created", {
        description: ticket.priority
          ? `AI triaged it as ${ticket.priority} priority.`
          : "AI triage didn’t run, so priority is unset. The ticket was saved.",
      });
      form.reset();
      router.refresh();
      return;
    }

    if (res.status === 400) {
      const body = (await res.json().catch(() => ({}))) as ErrorResponse;
      const fields =
        typeof body.error === "object" ? body.error.fieldErrors : undefined;
      for (const [name, messages] of Object.entries(fields ?? {})) {
        if (messages?.[0]) {
          form.setError(name as keyof Values, { message: messages[0] });
        }
      }
      return;
    }

    toast.error("Couldn’t create the ticket", {
      description:
        res.status === 403
          ? "Your role can’t create tickets. Ask an owner for agent access."
          : res.status === 401
            ? "Your session has ended. Sign in again, then retry."
            : "The server returned an error. Try again in a moment.",
    });
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Card id="new-ticket" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>New ticket</CardTitle>
        <CardDescription>
          Priority, category, and sentiment are set by AI when you create it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Invoice charged twice"
                      maxLength={200}
                      {...field}
                    />
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
                  <FormLabel>What the customer said</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste or summarise the customer’s message."
                      className="min-h-[120px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2
                      className="mr-2 size-4 animate-spin"
                      strokeWidth={1.5}
                    />
                    Creating…
                  </>
                ) : (
                  "Create ticket"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
