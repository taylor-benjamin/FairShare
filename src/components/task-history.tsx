import type { TaskHistoryItem } from "@/lib/services/team-health";
import { formatDate } from "./ui";

/** Reassignments and deletions for a team, newest first. Shared by the Tasks tab and the instructor team page. */
export function TaskHistoryList({ items, viewer }: { items: TaskHistoryItem[]; viewer: "student" | "instructor" }) {
  const instructorLabel = viewer === "instructor" ? "By you" : "By your instructor";
  return (
    <ul className="space-y-2">
      {items.map((h) => (
        <li key={h.key} className="rounded-xl bg-wash p-3.5 text-small">
          {h.kind === "reassigned" ? (
            <>
              <span className="font-semibold">{h.task_title}</span>: {h.from_name} → {h.to_name} · {formatDate(h.date)}
              <span className="block text-hint">
                {h.by_role === "instructor" ? instructorLabel : `By ${h.by_name}`}: {h.reassignment_reason}
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold">{h.task_title}</span>: deleted · {formatDate(h.date)}
              <span className="block text-hint">
                By {h.by_name}
                {h.requester_name && `, asked by ${h.requester_name}`}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
