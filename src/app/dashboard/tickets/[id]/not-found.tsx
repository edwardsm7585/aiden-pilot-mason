import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button, PageHeader } from "@upstart13-com/aiden-ui";

/** Missing, another agent's, or another org's ticket — deliberately one message. */
export default function TicketNotFound() {
  return (
    <div>
      <PageHeader title="Ticket not found" />
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="bg-muted mb-4 rounded-sm p-3">
          <SearchX className="text-muted-foreground size-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-base font-semibold">
          This ticket doesn’t exist or isn’t shared with you
        </h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Check the link, or find the ticket in your queue.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/dashboard/tickets">Back to tickets</Link>
        </Button>
      </div>
    </div>
  );
}
