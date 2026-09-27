/** Heading of a listing section page: the page's h1 and a short explanation. */
export function SectionHeading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="grid gap-1">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
