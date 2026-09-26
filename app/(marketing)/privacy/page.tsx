import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  return (
    <ComingSoon title="Privacy policy" milestone="M10">
      Our privacy policy will be published before launch.
    </ComingSoon>
  );
}
