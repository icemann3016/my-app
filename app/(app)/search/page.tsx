import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Find aircraft" };

export default function Page() {
  return (
    <ComingSoon title="Find aircraft" milestone="M5">
      Search aircraft by airport, dates and specs.
    </ComingSoon>
  );
}
