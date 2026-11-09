/**
 * EmptyState — one consistent way to show "nothing here yet" across the app.
 * A soft brand-tinted icon badge, a title, and an optional line of guidance.
 * Presentational only; callers pass an icon node and the copy.
 */
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
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
    </div>
  );
}
