"use client";

import { useState } from "react";
import { useAIStream } from "@upstart13-com/aiden-realtime/react";
import { toast } from "sonner";
import { Copy, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { selectedPill } from "@/components/selected-pill";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cn,
} from "@upstart13-com/aiden-ui";

type Tone = "friendly" | "formal" | "concise";
const TONES: { value: Tone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "concise", label: "Concise" },
];

/** `event: done` payload = the provider's final response (model, usage, …). */
type DraftFinal = { model?: string };

export function DraftPanel({ ticketId }: { ticketId: string }) {
  const [tone, setTone] = useState<Tone>("friendly");
  const { text, isLoading, error, final, send, reset } = useAIStream<
    { tone: Tone },
    DraftFinal
  >(`/api/tickets/${ticketId}/draft`);
  const done = !isLoading && !error && text.length > 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Draft copied", {
        description: "Paste it into your reply to the customer.",
      });
    } catch {
      toast.error("Couldn’t copy the draft", {
        description:
          "Your browser blocked clipboard access. Select the text and copy it instead.",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI draft reply</CardTitle>
        <CardDescription>
          A starting point you can copy into your reply. Nothing is sent to the
          customer.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p id="tone-label" className="text-sm font-medium">
            Tone
          </p>
          <div
            role="radiogroup"
            aria-labelledby="tone-label"
            className="flex flex-wrap gap-2"
          >
            {TONES.map((t) => (
              <Button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={tone === t.value}
                disabled={isLoading}
                onClick={() => setTone(t.value)}
                size="sm"
                variant="outline"
                className={cn(tone === t.value && selectedPill)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        <div
          aria-live="polite"
          aria-busy={isLoading}
          className="border-border bg-muted/30 min-h-40 rounded-sm border p-5"
        >
          {text ? (
            <p className="text-foreground max-w-prose text-sm leading-relaxed whitespace-pre-wrap">
              {text}
              {isLoading && (
                <span
                  aria-hidden
                  className="bg-primary ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 motion-safe:animate-pulse"
                />
              )}
            </p>
          ) : isLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
              Reading the ticket…
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Pick a tone and draft a reply. It streams in here as it’s written.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            Couldn’t draft a reply: the AI service didn’t respond. Try again,
            and if it keeps failing ask an owner to check the AI provider
            settings.
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground font-mono text-xs">
          {done && final?.model ? `Drafted with ${final.model}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {done && (
            <>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="mr-1.5 size-4" strokeWidth={1.5} />
                Clear
              </Button>
              <Button variant="ghost" size="sm" onClick={copy}>
                <Copy className="mr-1.5 size-4" strokeWidth={1.5} />
                Copy
              </Button>
            </>
          )}
          <Button onClick={() => send({ tone })} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Sparkles className="mr-2 size-4" strokeWidth={1.5} />
            )}
            {isLoading ? "Drafting…" : text ? "Redraft" : "Draft reply"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
