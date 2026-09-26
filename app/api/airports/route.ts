import { searchAirports } from "@/lib/airports";

/** Airport search for the airport picker: GET /api/airports?q=sofia */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchAirports(q.slice(0, 64));
  return Response.json(
    { results },
    { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
