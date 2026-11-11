export function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="page-title">{title}</h1>
      <p className="text-text-muted">Coming in the next phase.</p>
    </div>
  );
}
