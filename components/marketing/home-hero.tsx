import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import hero from "@/public/images/home/hero-above-clouds.jpg";

/** Full-width photo header with a slow zoom; `children` shows notices above the badge. */
export async function HomeHero({ children }: { children?: React.ReactNode }) {
  const t = await getTranslations("home");
  return (
    <section className="relative isolate overflow-hidden bg-slate-900 text-white">
      <Image
        src={hero}
        alt=""
        priority
        placeholder="blur"
        sizes="100vw"
        className="hero-zoom absolute inset-0 -z-20 size-full object-cover object-[70%_center]"
      />
      {/* Darker on the text side so the words stay readable on any screen. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/85 via-slate-950/55 to-slate-950/10" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-slate-950/50 to-transparent" />

      <div className="mx-auto flex min-h-[560px] max-w-6xl flex-col items-start justify-center gap-6 px-4 py-20 sm:min-h-[640px]">
        {children}
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
          {t("badge")}
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance drop-shadow sm:text-6xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-lg text-pretty text-white/90">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
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
