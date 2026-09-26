import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Terms of service" };

export default function Page() {
  return (
    <ComingSoon title="Terms of service" milestone="M10">
      Our terms will be published before launch.
    </ComingSoon>
  );
}
