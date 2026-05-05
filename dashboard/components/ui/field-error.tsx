import { cn } from '@/lib/utils';

export function FieldError({
  message,
  className,
}: {
  message?: string;
  className?: string;
}): JSX.Element | null {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn('mt-1 text-xs font-medium text-kammaren-red', className)}
    >
      {message}
    </p>
  );
}
