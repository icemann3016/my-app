import Link from "next/link";

/** A number with a label, optionally linking to where the details are. */
export function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="block text-2xl font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-md border p-3 hover:bg-accent">
      {body}
    </Link>
  ) : (
    <div className="rounded-md border p-3">{body}</div>
  );
}
