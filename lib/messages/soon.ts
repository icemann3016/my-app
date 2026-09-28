import "server-only";

import { after } from "next/server";

import { deliverMessageEmails } from "./emails";

/** After the response is sent, email about new messages (the daily job catches up misses). */
export function sendMessageEmailsSoon() {
  after(() => deliverMessageEmails().catch((e) => console.error("[messages] delivery failed", e)));
}
