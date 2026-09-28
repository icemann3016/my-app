import "server-only";

import { after } from "next/server";

import { reportError } from "@/lib/monitoring";
import { deliverNotificationEmails } from "./index";

/** After the response is sent, email any new notifications (the daily job catches up misses). */
export function sendNotificationsSoon() {
  after(() =>
    deliverNotificationEmails().catch((e) => reportError(e, { where: "notification emails" })),
  );
}
