import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberDetail } from "@/lib/admin/member-detail";
import { isSocialProvider, PROVIDER_NAMES } from "@/lib/auth/provider-list";
import { isLocale } from "@/lib/i18n/config";

/** Private account facts: email and whether it's confirmed, sign-in methods, language, phone. */
export async function AccountCard({ m }: { m: MemberDetail }) {
  const t = await getTranslations("admin.member.account");
  const tsign = await getTranslations("account.signIn");
  const tlang = await getTranslations("common.languages");
  const methods = m.signInMethods.map((p) =>
    p === "credential" ? tsign("password") : isSocialProvider(p) ? PROVIDER_NAMES[p] : p,
  );
  const rows: [string, React.ReactNode][] = [
    [
      t("email"),
      <>
        <a href={`mailto:${m.email}`} className="underline-offset-4 hover:underline">
          {m.email}
        </a>{" "}
        <span className={m.emailVerified ? "text-success" : "text-warning"}>
          ({m.emailVerified ? t("emailVerified") : t("emailNotVerified")})
        </span>
      </>,
    ],
    [t("signIn"), methods.join(", ") || t("notSet")],
    [t("language"), m.locale && isLocale(m.locale) ? tlang(m.locale) : t("notSet")],
    [t("phone"), m.phone ?? t("notSet")],
    [t("homeAirfield"), m.homeAirportIdent ?? t("notSet")],
    [t("sessions"), String(m.activeSessions)],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
