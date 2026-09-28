import "server-only";

import { after } from "next/server";

import { deliverNotificationEmails } from "./index";

/** After the response is sent, email any new notifications (the daily job catches up misses). */
export function sendNotificationsSoon() {
  after(() =>
    deliverNotificationEmails().catch((e) => console.error("[notifications] delivery failed", e)),
  );
}
