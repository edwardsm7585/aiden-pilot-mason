import { redirect } from "next/navigation";

/** DeskLine's home is the ticket queue. */
export default function DashboardPage() {
  redirect("/dashboard/tickets");
}
