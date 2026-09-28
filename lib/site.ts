/** Site-wide settings. Rename the app here. Labels live in messages/*.json → common.nav/footer. */
export const siteConfig = {
  name: "ownAplane",
  mainNav: [
    { href: "/search", key: "findAircraft" },
    { href: "/owner/aircraft", key: "listAircraft" },
  ],
  footerNav: [
    { href: "/help", key: "help" },
    { href: "/terms", key: "terms" },
    { href: "/privacy", key: "privacy" },
  ],
} as const;
