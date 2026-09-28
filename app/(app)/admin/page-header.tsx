/** Heading block of an admin page. */
export function AdminHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}
