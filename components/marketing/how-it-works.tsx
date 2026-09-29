import { SearchIcon, SendIcon, StarIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

const steps = [
  { key: "search", icon: SearchIcon },
  { key: "request", icon: SendIcon },
  { key: "fly", icon: StarIcon },
] as const;

/** Three numbered steps from search to review, joined by a dashed "route" on wide screens. */
export async function HowItWorks() {
  const t = await getTranslations("home.how");
  return (
    <section aria-labelledby="how-it-works" className="mx-auto max-w-6xl px-4 py-16">
      <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {t("heading")}
      </h2>
      <ol className="relative mt-8 grid gap-8 md:grid-cols-3">
        <span
          aria-hidden
          className="absolute top-6 right-[16%] left-[16%] hidden border-t-2 border-dashed border-primary/30 md:block"
        />
        {steps.map(({ key, icon: Icon }, i) => (
          <li
            key={key}
            className="relative grid justify-items-start gap-3 md:justify-items-center md:text-center"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-8 ring-background">
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="font-semibold">
              <span className="text-muted-foreground">{i + 1}. </span>
              {t(`${key}.title`)}
            </h3>
            <p className="max-w-xs text-sm text-muted-foreground">{t(`${key}.text`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
