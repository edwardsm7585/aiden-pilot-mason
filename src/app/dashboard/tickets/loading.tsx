import { Card, CardContent, CardHeader, Skeleton } from "@upstart13-com/aiden-ui";

/** Skeleton matching the ticket list: header, filters, 6-column table, form card. */
export default function TicketsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading tickets">
      <div className="border-border border-b px-6 py-5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-lg" />
            ))}
          </div>
          <div className="border-border rounded-sm border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border-border flex items-center gap-6 border-b px-4 py-3 last:border-b-0"
              >
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-16 rounded-sm" />
                <Skeleton className="h-5 w-16 rounded-sm" />
                <Skeleton className="h-5 w-20 rounded-sm" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="ml-auto h-9 w-28" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
