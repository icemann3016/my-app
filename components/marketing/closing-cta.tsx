import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import sunset from "@/public/images/home/sunset-silhouette.jpg";

/** Last band on the home page: a sunset photo with a short invitation and the two main actions. */
export async function ClosingCta() {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="relative isolate overflow-hidden rounded-2xl bg-slate-900 px-6 py-16 text-white sm:px-12">
        <Image
          src={sunset}
          alt=""
          placeholder="blur"
          sizes="(min-width: 1152px) 1152px, 100vw"
          className="absolute inset-0 -z-20 size-full object-cover object-[center_60%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-slate-950/10" />
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("cta.title")}
        </h2>
        <p className="mt-2 max-w-md text-white/90">{t("cta.text")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" variant="secondary" asChild>
            <Link href="/search">{t("findAircraft")}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/60 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
            asChild
          >
            <Link href="/owner/aircraft">{t("listAircraft")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
