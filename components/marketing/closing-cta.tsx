import Link from "next/link";
import { PlaneIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/** Last band on the home page: a short invitation with the two main actions. */
export async function ClosingCta() {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
        <PlaneIcon
          aria-hidden
          className="cta-plane pointer-events-none absolute -right-6 -bottom-6 size-48 rotate-45 opacity-10"
        />
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("cta.title")}
        </h2>
        <p className="mt-2 max-w-xl opacity-90">{t("cta.text")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" variant="secondary" asChild>
            <Link href="/search">{t("findAircraft")}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            asChild
          >
            <Link href="/owner/aircraft">{t("listAircraft")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
