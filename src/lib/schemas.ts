import { z } from "zod";
import { ORG_ROLES } from "@/config/rbac";

/**
 * Named request schemas for the DeskLine API (plan §4). Bodies go through
 * `parseRequest`, params and query through `parseInput`.
 */

export const TicketId = z.object({ id: z.string().cuid() });

export const MemberId = z.object({ id: z.string().cuid() });

export const UserId = z.object({ id: z.string().cuid() });

export const ListTicketsQuery = z.object({
  status: z.enum(["open", "pending", "closed"]).optional(),
});

const Subject = z
  .string()
  .trim()
  .min(1, "Enter a subject")
  .max(200, "Keep the subject under 200 characters");
const Body = z
  .string()
  .trim()
  .min(1, "Enter the customer’s message")
  .max(10_000, "Keep the message under 10,000 characters");

export const CreateTicketBody = z.object({ subject: Subject, body: Body });

export const UpdateTicketBody = z
  .object({
    subject: Subject.optional(),
    body: Body.optional(),
    status: z.enum(["open", "pending"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field required");

export const DraftBody = z.object({
  tone: z.enum(["friendly", "formal", "concise"]).default("friendly"),
});

export const RoleChangeBody = z.object({ role: z.enum(ORG_ROLES) });

/** AI triage output — enum-only, so the model can't write free text into a ticket. */
export const TriageSchema = z.object({
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.enum([
    "billing",
    "technical",
    "account",
    "feature_request",
    "other",
  ]),
  sentiment: z.enum(["positive", "neutral", "negative"]),
});

export type Triage = z.infer<typeof TriageSchema>;
