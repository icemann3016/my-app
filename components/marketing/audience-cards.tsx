import Image, { type StaticImageData } from "next/image";
import { Building2Icon, CalendarCheckIcon, PlaneIcon, WrenchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import airport from "@/public/images/home/airport-taxiway.jpg";
import owner from "@/public/images/home/owner-parked.jpg";
import pilot from "@/public/images/home/pilot-headset.jpg";
import technician from "@/public/images/home/technician-nose.jpg";

const audiences: {
  key: "pilots" | "owners" | "technicians" | "airports";
  icon: typeof PlaneIcon;
  photo: StaticImageData;
  soon: boolean;
}[] = [
  { key: "pilots", icon: PlaneIcon, photo: pilot, soon: false },
  { key: "owners", icon: CalendarCheckIcon, photo: owner, soon: false },
  { key: "technicians", icon: WrenchIcon, photo: technician, soon: true },
  { key: "airports", icon: Building2Icon, photo: airport, soon: true },
];

/** "Who it's for": a photo card for pilots, owners, technicians and airports. */
export async function AudienceCards() {
  const t = await getTranslations("home");
  return (
    <section aria-labelledby="audiences" className="mx-auto max-w-6xl px-4 py-16">
      <h2 id="audiences" className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {t("audiencesHeading")}
      </h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {audiences.map(({ key, icon: Icon, photo, soon }) => (
          <Card
            key={key}
            className="group gap-3 overflow-hidden pt-0 transition-shadow duration-300 hover:shadow-lg"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={photo}
                alt=""
                placeholder="blur"
                sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {soon && (
                <span className="absolute top-3 right-3 rounded-full bg-slate-950/70 px-2 py-0.5 text-xs text-white backdrop-blur">
                  {t("comingLater")}
                </span>
              )}
            </div>
            <CardHeader className="pt-3">
              <CardTitle as="h3" className="flex items-center gap-2">
                <Icon className="size-4 text-primary" aria-hidden />
                {t(`${key}.title`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{t(`${key}.text`)}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
