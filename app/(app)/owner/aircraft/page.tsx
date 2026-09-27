import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRightIcon, PlaneIcon, PlusIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AircraftStatusBadge } from "@/components/aircraft/aircraft-status-badge";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { aircraftTitle, DOCUMENT_PROBLEMS } from "@/lib/aircraft/catalog";
import { formatMoney } from "@/lib/aircraft/format";
import { getOwnerAircraft } from "@/lib/aircraft/queries";
import { requireProfile } from "@/lib/auth/session";
import { setRole } from "../../account/actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.list");
  return { title: t("title") };
}

export default async function MyAircraftPage() {
  const { userId, roles } = await requireProfile("/owner/aircraft");
  const t = await getTranslations("owner.list");
  const ts = await getTranslations("aircraft.statuses");
  const locale = await getLocale();

  if (!roles.includes("owner")) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Card>
          <CardHeader>
            <PlaneIcon className="size-5 text-primary" aria-hidden />
            <CardTitle as="h2">{t("notOwnerTitle")}</CardTitle>
            <CardDescription>{t("notOwnerText")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={setRole}>
              <input type="hidden" name="role" value="owner" />
              <input type="hidden" name="enable" value="true" />
              <SubmitButton>{t("switchOn")}</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const list = await getOwnerAircraft(userId);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href="/owner/aircraft/new">
            <PlusIcon aria-hidden /> {t("add")}
          </Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <PlaneIcon className="size-8 text-primary" aria-hidden />
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t("emptyText")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {list.map((a) => {
            const todo = a.problems.filter(
              (p) => !(DOCUMENT_PROBLEMS as readonly string[]).includes(p),
            ).length;
            const docsOnly = todo === 0 && a.problems.length > 0;
            const note =
              a.status === "unlisted" && a.statusReason === "documents_expired"
                ? t("unlistedExpired")
                : a.status === "listed" || a.status === "paused"
                  ? null
                  : todo > 0
                    ? t("todo", { count: todo })
                    : docsOnly
                      ? a.publishRequestedAt
                        ? t("goesLiveAfterCheck")
                        : t("waitingForCheck")
                      : t("readyToPublish");
            return (
              <li key={a.id}>
                <Link
                  href={`/owner/aircraft/${a.id}`}
                  className="flex items-center gap-4 rounded-xl border bg-card p-3 hover:bg-accent/50"
                >
                  <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:w-32">
                    {a.coverUrl ? (
                      <Image src={a.coverUrl} alt="" fill sizes="128px" className="object-cover" />
                    ) : (
                      <PlaneIcon
                        className="absolute inset-0 m-auto size-6 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-medium">{aircraftTitle(a)}</h2>
                      <AircraftStatusBadge status={a.status} label={ts(a.status)} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono">{a.registration}</span>
                      {a.homeAirportIdent && <> · {a.homeAirportIdent}</>}
                      {a.pricePerHour !== null && (
                        <>
                          {" "}
                          ·{" "}
                          {t("perHour", {
                            price: formatMoney(a.pricePerHour, a.currency, locale),
                          })}
                        </>
                      )}
                    </p>
                    {note && <p className="text-sm">{note}</p>}
                  </div>
                  <ChevronRightIcon className="ml-auto size-4 shrink-0" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
