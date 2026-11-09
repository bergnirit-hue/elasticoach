import Link from "next/link";

export interface ScopeOption {
  /** null = the coach default. */
  clientId: string | null;
  label: string;
}

/** Switch between the coach default and each client's override. */
export function ScopeTabs({
  options,
  activeClientId,
}: {
  options: ScopeOption[];
  activeClientId: string | null;
}) {
  return (
    <nav aria-label="היקף הכללים" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.clientId === activeClientId;
        return (
          <Link
            key={o.clientId ?? "default"}
            href={
              o.clientId
                ? `/coach-rules?client=${encodeURIComponent(o.clientId)}`
                : "/coach-rules"
            }
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${
              active
                ? "border-black bg-black text-white"
                : "border-black/15 hover:bg-black/5"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
