/**
 * EmptyState — one consistent way to show "nothing here yet" across the app.
 * A soft brand-tinted icon badge, a title, an optional line of guidance, and an
 * optional action (an empty screen is an invitation to act, not a dead end).
 * Presentational only; callers pass an icon node, the copy, and any action node.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
          {icon}
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="max-w-xs text-sm text-ink-soft">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
