"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  ClientsIcon,
  PlateIcon,
  SettingsIcon,
  TodayIcon,
  type IconProps,
} from "./icons";

/**
 * Primary navigation for the authed app. Phone-first: a sticky bottom tab bar
 * on small screens (the pattern Israeli users expect on mobile), an inline row
 * in the header from `sm` up. Active route is highlighted with the brand token,
 * so it re-skins with a coach's --brand. Icons are inline SVG (currentColor).
 */
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
          {
            href: "/menus",
            label: "תפריטים",
            Icon: PlateIcon,
            isActive: (p: string) => p.startsWith("/menus"),
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
