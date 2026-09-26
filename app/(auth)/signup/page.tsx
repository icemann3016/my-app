import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Sign up" };

export default function Page() {
  return (
    <ComingSoon title="Sign up" milestone="M1">
      Accounts are on the way.
    </ComingSoon>
  );
}
