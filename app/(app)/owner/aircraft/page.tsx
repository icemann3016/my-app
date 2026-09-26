import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "List your aircraft" };

export default function Page() {
  return (
    <ComingSoon title="List your aircraft" milestone="M4">
      List your aircraft, set prices and choose who can rent it.
    </ComingSoon>
  );
}
