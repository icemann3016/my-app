import { AdminTabs } from "@/components/admin/admin-tabs";
import { requireAdmin } from "@/lib/auth/session";

/** Admin area: tabs over every admin page (each page checks the admin role itself too). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 pt-6">
        <AdminTabs />
      </div>
      {children}
    </>
  );
}
