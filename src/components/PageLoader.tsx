export function PageLoader({
  message = 'Cargando...',
  overlay = true,
}: {
  message?: string;
  overlay?: boolean;
}) {
  const loader = (
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin border-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/75 dark:bg-black/60">
        {loader}
      </div>
    );
  }

  // Inline loader (no overlay) so switching routes doesn't show a full-screen flash
  return (
    <div className="flex items-center justify-center h-full">
      {loader}
    </div>
  );
}

export default PageLoader;
