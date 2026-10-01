import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@upstart13-com/aiden-ui";

/**
 * Skeleton for the admin pages (Members, Audit log, AI cost): page header
 * plus a table, the shape all three share (DS 07 table skeleton). The shell
 * and sidebar stay rendered by the admin layout.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="border-border border-b px-6 py-5">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="px-6 py-8">
        <div className="border-border rounded-sm border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-32" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
                <TableHead>
                  <Skeleton className="ml-auto h-4 w-12" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-lg" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-12" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
