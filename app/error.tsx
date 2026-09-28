"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Something broke while showing a page: say so, offer a retry and report it (KAN-70). */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.error");
  useEffect(() => {
    // Server errors are already reported (they have a digest); report errors of the browser.
    if (error.digest) return;
    void fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message.slice(0, 500),
        name: error.name,
        stack: error.stack?.slice(0, 4000),
        path: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("text")}</p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          {t("reference", { digest: error.digest })}
        </p>
      )}
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
