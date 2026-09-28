import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { MessageComposer } from "@/components/messages/message-composer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getVisibleAircraft } from "@/lib/aircraft/public";
import { isUuid } from "@/lib/aircraft/queries";
import { requireUser } from "@/lib/auth/session";
import { findEnquiry, startConversation } from "@/lib/messages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messages");
  return { title: t("newTitle") };
}

/**
 * Start messaging (MSG-1): `?booking=` opens the booking's conversation; `?aircraft=` asks the
 * owner about a listing (or opens the enquiry already started).
 */
export default async function NewConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ aircraft?: string; booking?: string }>;
}) {
  const { aircraft, booking } = await searchParams;
  const query = booking ? `booking=${booking}` : `aircraft=${aircraft ?? ""}`;
  const user = await requireUser(`/messages/new?${query}`);
  if (booking) {
    if (!isUuid(booking)) notFound();
    const result = await startConversation(
      user.id,
      { aircraftId: booking, bookingId: booking },
      null,
    );
    if (!result.ok) notFound();
    redirect(`/messages/${result.value}`);
  }
  if (!aircraft || !isUuid(aircraft)) notFound();
  const existing = await findEnquiry(user.id, aircraft);
  if (existing) redirect(`/messages/${existing}`);
  const row = await getVisibleAircraft(user.id, aircraft);
  if (!row || row.aircraft.ownerId === user.id || row.aircraft.status !== "listed") notFound();
  const t = await getTranslations("messages");
  const a = row.aircraft;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t("askTitle", { name: row.owner.displayName })}</CardTitle>
          <CardDescription>
            {a.manufacturer} {a.model} <span className="font-mono">{a.registration}</span>.{" "}
            {t("askText")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MessageComposer aircraftId={a.id} />
        </CardContent>
      </Card>
    </div>
  );
}
