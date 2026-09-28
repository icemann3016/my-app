import Link from "next/link";
import { MailIcon, PhoneIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBookingContact } from "@/lib/bookings/queries";

/** The other side's email and phone, shared once the booking is accepted (MSG-2). */
export async function BookingContact({
  userId,
  bookingId,
  isOwner,
}: {
  userId: string;
  bookingId: string;
  isOwner: boolean;
}) {
  const contact = await getBookingContact(userId, bookingId);
  if (!contact) return null;
  const t = await getTranslations("booking.contact");
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t(isOwner ? "titlePilot" : "titleOwner")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Link href={`/u/${contact.userId}`} className="font-medium hover:underline">
          {contact.name}
        </Link>
        <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:underline">
          <MailIcon className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("email")}: </span>
          {contact.email}
        </a>
        {contact.phone ? (
          <a
            href={`tel:${contact.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 hover:underline"
          >
            <PhoneIcon className="size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">{t("phone")}: </span>
            {contact.phone}
          </a>
        ) : (
          <p className="flex items-center gap-2 text-muted-foreground">
            <PhoneIcon className="size-4" aria-hidden /> {t("noPhone")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("note")}</p>
      </CardContent>
    </Card>
  );
}
