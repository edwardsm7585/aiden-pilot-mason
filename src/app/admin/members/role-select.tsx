"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORG_ROLES, type OrgRole } from "@/config/rbac";

const LABEL: Record<OrgRole, string> = {
  owner: "Owner",
  agent: "Agent",
  viewer: "Viewer",
};

interface RoleSelectProps {
  membershipId: string;
  name: string;
  role: OrgRole;
}

/** Saves on change (PATCH /api/admin/members/[id]); reverts if the server refuses. */
export function RoleSelect({ membershipId, name, role }: RoleSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState<OrgRole>(role);
  const [saving, setSaving] = useState(false);

  async function change(next: OrgRole) {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    let status = 0;
    try {
      const res = await fetch(`/api/admin/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      status = res.status;
    } catch {
      status = -1;
    }
    setSaving(false);

    if (status === 200) {
      toast.success("Role updated", {
        description: `${name} is now ${next === "agent" ? "an" : "a"} ${LABEL[next].toLowerCase()}.`,
      });
      router.refresh();
      return;
    }
    setValue(previous);
    toast.error("Couldn’t change the role", {
      description:
        status === 409
          ? "The organisation must keep at least one owner. Make someone else an owner first."
          : status === 403
            ? "Only owners can change roles."
            : status === -1
              ? "The request didn’t reach the server. Check your connection."
              : "The server returned an error. Try again in a moment.",
    });
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => change(v as OrgRole)}
      disabled={saving}
    >
      <SelectTrigger className="w-full" aria-label={`Role for ${name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORG_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {LABEL[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
