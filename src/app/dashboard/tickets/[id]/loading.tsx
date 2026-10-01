import {
  Card,
  CardContent,
  CardHeader,
  Skeleton,
} from "@upstart13-com/aiden-ui";

/** Skeleton matching the ticket detail: message + draft cards, details + edit cards. */
export default function TicketLoading() {
  return (
    <div aria-busy="true" aria-label="Loading ticket">
      <div className="border-border border-b px-6 py-5">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="px-6 py-8">
        {/* Reply / Edit ticket tabs */}
        <div className="flex gap-4">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full rounded-sm" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-sm" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
