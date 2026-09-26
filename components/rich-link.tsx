import Link from "next/link";

/** Link for rich translations, e.g. t.rich("acceptTerms", { terms: richLink("/terms") }). */
export function richLink(href: string) {
  return function RichLink(chunks: React.ReactNode) {
    return (
      <Link href={href} className="underline underline-offset-4" target="_blank">
        {chunks}
      </Link>
    );
  };
}
