import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";

export default async function AdminPage() {
  await requireAdmin();
  redirect("/admin/verifications");
}
