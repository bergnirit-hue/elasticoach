"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Primary navigation for the authed app. Phone-first: a sticky bottom tab bar
 * on small screens (the pattern Israeli users expect on mobile), an inline row
 * in the header from `sm` up. Active route is highlighted with the brand token,
 * so it re-skins with a coach's --brand. Icons are inline SVG (currentColor).
 */
type IconProps = { className?: string };

function TodayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

function ClientsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
      <path d="M17 14.3A5.5 5.5 0 0 1 20.5 19" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 7l1.9 1.1M17.9 15.9l1.9 1.1M4.2 17l1.9-1.1M17.9 8.1l1.9-1.1" />
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  Icon: (p: IconProps) => React.ReactElement;
  isActive: (pathname: string) => boolean;
};

export function AppNav({ isCoach }: { isCoach: boolean }) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/me", label: "המעקב שלי", Icon: TodayIcon, isActive: (p) => p === "/me" },
    ...(isCoach
      ? [
          {
            href: "/clients",
            label: "המתאמנים שלי",
            Icon: ClientsIcon,
            isActive: (p: string) => p.startsWith("/clients"),
          },
        ]
      : []),
    { href: "/calendar", label: "לוח שנה", Icon: CalendarIcon, isActive: (p) => p.startsWith("/calendar") },
    { href: "/settings", label: "הגדרות", Icon: SettingsIcon, isActive: (p) => p.startsWith("/settings") },
  ];

  return (
    <>
      {/* Desktop / tablet: inline row inside the header */}
      <nav className="hidden items-center gap-1 sm:flex" aria-label="ניווט ראשי">
        {items.map(({ href, label, Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-brand-soft font-medium text-brand"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: fixed bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="ניווט ראשי"
      >
        <div className="mx-auto flex max-w-2xl items-stretch justify-around">
          {items.map(({ href, label, Icon, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors ${
                  active ? "font-medium text-brand" : "text-ink-soft"
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
