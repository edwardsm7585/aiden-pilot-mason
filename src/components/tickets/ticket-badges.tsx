import { Badge } from "@upstart13-com/aiden-ui";

/**
 * Semantic badges for ticket fields (plan "Design plan"). Status and
 * priority carry meaning through the DS Badge variants; category and
 * sentiment are plain outline tags. Unknown/missing values render "—".
 */

const STATUS = {
  open: { label: "Open", variant: "info" },
  pending: { label: "Pending", variant: "warning" },
  closed: { label: "Closed", variant: "secondary" },
} as const;

const PRIORITY = {
  urgent: { label: "Urgent", variant: "destructive" },
  high: { label: "High", variant: "error" },
  medium: { label: "Medium", variant: "warning" },
  low: { label: "Low", variant: "secondary" },
} as const;

const CATEGORY: Record<string, string> = {
  billing: "Billing",
  technical: "Technical",
  account: "Account",
  feature_request: "Feature request",
  other: "Other",
};

const SENTIMENT: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS];
  if (!s) return <Empty />;
  return (
    <Badge variant={s.variant} className="gap-1.5">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  const p = priority ? PRIORITY[priority as keyof typeof PRIORITY] : null;
  if (!p) return <Empty />;
  return <Badge variant={p.variant}>{p.label}</Badge>;
}

export function CategoryBadge({ category }: { category: string | null }) {
  if (!category || !CATEGORY[category]) return <Empty />;
  return <Badge variant="outline">{CATEGORY[category]}</Badge>;
}

export function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment || !SENTIMENT[sentiment]) return <Empty />;
  return <Badge variant="outline">{SENTIMENT[sentiment]}</Badge>;
}
