import type { ListingGap } from "@/lib/aircraft/catalog";

// Profile completion (dashboard and /welcome): what the user still has to do themselves.
// Anything waiting for an admin (a credential or aircraft document being checked) counts as
// done from the user's side and is listed separately as "waiting".

export type CompletionItem = {
  key: string;
  group: "start" | "profile" | "pilot" | "owner";
  done: boolean;
  href: string;
  /** Message key in "completion.items" and its values. */
  label: string;
  values?: Record<string, string | number>;
};

export type CompletionInput = {
  roles: { pilot: boolean; owner: boolean };
  profile: { avatarKey: string | null; homeAirportIdent: string | null; bio: string | null };
  phone: string | null;
  pilot: {
    items: {
      kind: "licence" | "rating" | "medical";
      status: string;
      ratingKind?: string;
      expired: boolean;
    }[];
    hasExperience: boolean;
  } | null;
  aircraft: {
    id: string;
    registration: string;
    status: string;
    gaps: ListingGap[];
    /** Document kinds uploaded and waiting for an admin. */
    pendingKinds: string[];
  }[];
};

const GAP_PAGE: Record<ListingGap, string> = {
  home_base: "base",
  price: "pricing",
  photo: "photos",
  arc: "documents",
  insurance: "documents",
};

export function profileCompletion(input: CompletionInput) {
  const items: CompletionItem[] = [];
  const waiting: CompletionItem[] = [];
  const add = (item: CompletionItem) => items.push(item);
  const { roles, profile } = input;

  add({
    key: "roles",
    group: "start",
    done: roles.pilot || roles.owner,
    href: "/welcome?step=roles",
    label: "roles",
  });
  add({
    key: "photo",
    group: "profile",
    done: Boolean(profile.avatarKey),
    href: "/account",
    label: "photo",
  });
  add({
    key: "home",
    group: "profile",
    done: Boolean(profile.homeAirportIdent),
    href: "/account",
    label: "home",
  });
  add({ key: "bio", group: "profile", done: Boolean(profile.bio), href: "/account", label: "bio" });
  add({
    key: "phone",
    group: "profile",
    done: Boolean(input.phone),
    href: "/account#contact",
    label: "phone",
  });

  if (roles.pilot && input.pilot) {
    const live = input.pilot.items.filter((i) => i.status !== "rejected");
    const has = (kind: string, ratingKind?: string) =>
      live.some((i) => i.kind === kind && (!ratingKind || i.ratingKind === ratingKind));
    const creds = "/account/credentials";
    add({ key: "licence", group: "pilot", done: has("licence"), href: creds, label: "licence" });
    add({ key: "medical", group: "pilot", done: has("medical"), href: creds, label: "medical" });
    add({
      key: "classRating",
      group: "pilot",
      done: has("rating", "class"),
      href: creds,
      label: "classRating",
    });
    add({
      key: "experience",
      group: "pilot",
      done: input.pilot.hasExperience,
      href: creds,
      label: "experience",
    });
    const rejected = input.pilot.items.filter((i) => i.status === "rejected").length;
    if (rejected)
      add({
        key: "rejected",
        group: "pilot",
        done: false,
        href: creds,
        label: "rejected",
        values: { count: rejected },
      });
    const expired = live.filter((i) => i.expired).length;
    if (expired)
      add({
        key: "expired",
        group: "pilot",
        done: false,
        href: creds,
        label: "expired",
        values: { count: expired },
      });
    const pending = input.pilot.items.filter((i) => i.status === "pending").length;
    if (pending)
      waiting.push({
        key: "pendingCreds",
        group: "pilot",
        done: true,
        href: creds,
        label: "pendingCreds",
        values: { count: pending },
      });
  }

  if (roles.owner) {
    add({
      key: "aircraft",
      group: "owner",
      done: input.aircraft.length > 0,
      href: "/owner/aircraft/new",
      label: "aircraft",
    });
    for (const a of input.aircraft.filter((x) => x.status === "draft" || x.status === "unlisted")) {
      const base = `/owner/aircraft/${a.id}`;
      const mine = a.gaps.filter(
        (g) => !((g === "arc" || g === "insurance") && a.pendingKinds.includes(g)),
      );
      for (const gap of mine) {
        add({
          key: `${a.id}-${gap}`,
          group: "owner",
          done: false,
          href: `${base}/${GAP_PAGE[gap]}`,
          label: `gap.${gap}`,
          values: { registration: a.registration },
        });
      }
      for (const kind of a.gaps.filter((g) => !mine.includes(g))) {
        waiting.push({
          key: `${a.id}-${kind}-pending`,
          group: "owner",
          done: true,
          href: `${base}/documents`,
          label: `pendingDoc.${kind}`,
          values: { registration: a.registration },
        });
      }
      if (a.gaps.length === 0) {
        add({
          key: `${a.id}-publish`,
          group: "owner",
          done: false,
          href: base,
          label: "publish",
          values: { registration: a.registration },
        });
      }
    }
  }

  const done = items.filter((i) => i.done).length;
  return {
    percent: Math.round((done / items.length) * 100),
    items,
    todo: items.filter((i) => !i.done),
    waiting,
  };
}

export type ProfileCompletion = ReturnType<typeof profileCompletion>;
