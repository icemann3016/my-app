import type { Instrumentation } from "next";

// Server errors in pages, routes and Server Actions go to error monitoring (KAN-70).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isClientAbort, reportError } = await import("@/lib/monitoring");
  if (isClientAbort(err)) return;
  await reportError(err, {
    where: context.routePath,
    method: request.method,
    path: request.path,
    tags: { routeType: context.routeType, router: context.routerKind },
  });
};
