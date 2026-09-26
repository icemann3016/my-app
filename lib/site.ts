/** Site-wide settings. Rename the app here. */
export const siteConfig = {
  name: "my-app",
  description:
    "Rent aircraft from verified owners across Europe. Pilots, owners, technicians and airports in one place.",
  mainNav: [
    { href: "/search", label: "Find aircraft" },
    { href: "/owner/aircraft", label: "List your aircraft" },
  ],
  footerNav: [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
  ],
} as const;
