// A stand-in for aviationweather.gov during browser tests (started by playwright.config.ts):
// LBSF reports mist and a low overcast now and in the forecast, so warnings always show.
import { createServer } from "node:http";

const port = Number(process.env.WEATHER_MOCK_PORT ?? 4555);
const pad = (n) => String(n).padStart(2, "0");
const dh = (d) => `${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const now = new Date();
  const issued = `${pad(now.getUTCDate())}${pad(now.getUTCHours())}00Z`;
  const from = new Date(now.getTime() - 3_600_000);
  const to = new Date(now.getTime() + 30 * 3_600_000);
  const station = { icaoId: "LBSF", lat: 42.695, lon: 23.406 };
  const kind = url.pathname.split("/").pop();
  const wanted = url.searchParams.get("ids");
  const body =
    wanted && wanted !== "LBSF"
      ? []
      : kind === "metar"
        ? [{ ...station, rawOb: `METAR LBSF ${issued} 00000KT 2000 BR OVC005 10/09 Q1021` }]
        : kind === "taf"
          ? [
              {
                ...station,
                rawTAF: `TAF LBSF ${issued} ${dh(from)}/${dh(to)} 00000KT 2000 BR OVC005`,
              },
            ]
          : [];
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}).listen(port, "127.0.0.1");
