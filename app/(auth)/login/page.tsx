import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <ComingSoon title="Log in" milestone="M1">
      Accounts are on the way.
    </ComingSoon>
  );
}
