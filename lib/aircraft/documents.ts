import "server-only";

import { asc, eq } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";
import { aircraftDocuments, documents } from "@/lib/db/schema";

/** An aircraft's documents with their files, as the viewer may see them (owner or admin). */
export async function getAircraftDocuments(viewerId: string, aircraftId: string) {
  return asUser(viewerId, (tx) =>
    tx
      .select({
        id: aircraftDocuments.id,
        kind: aircraftDocuments.kind,
        title: aircraftDocuments.title,
        expiresOn: aircraftDocuments.expiresOn,
        status: aircraftDocuments.status,
        rejectionReason: aircraftDocuments.rejectionReason,
        reviewedBy: aircraftDocuments.reviewedBy,
        reviewedAt: aircraftDocuments.reviewedAt,
        updatedAt: aircraftDocuments.updatedAt,
        documentId: aircraftDocuments.documentId,
        filename: documents.filename,
      })
      .from(aircraftDocuments)
      .innerJoin(documents, eq(documents.id, aircraftDocuments.documentId))
      .where(eq(aircraftDocuments.aircraftId, aircraftId))
      .orderBy(asc(aircraftDocuments.kind), asc(aircraftDocuments.createdAt)),
  );
}

export type AircraftDocumentRow = Awaited<ReturnType<typeof getAircraftDocuments>>[number];
