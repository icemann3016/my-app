#!/usr/bin/env node
/**
 * Demo data for presentations and the private beta (KAN-73): owners with listed aircraft,
 * verified pilots, a completed booking with published reviews, an accepted and a requested
 * booking, and a conversation. Every demo account uses an @demo.ownaplane.eu address and
 * "(demo)" in its name, so it's easy to spot and to remove.
 *
 *   npm run demo:seed -- --yes            # add (again): removes old demo data first
 *   npm run demo:seed -- --remove --yes   # remove all demo data
 *
 * Log in as e.g. owner.maria@demo.ownaplane.eu with the password in DEMO_PASSWORD
 * (default "demo-flight-2026"). Uses DATABASE_URL_MIGRATIONS or DATABASE_URL from .env.local.
 * Needs the airports (npm run airports:import). Aircraft have no photos or documents: the
 * listing checks are skipped for them, so add real photos before showing the search page.
 */
import nextEnv from "@next/env";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const DOMAIN = "demo.ownaplane.eu";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-flight-2026";
const url = process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;
const remove = process.argv.includes("--remove");

if (!url) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}
const host = new URL(url).hostname;
if (!process.argv.includes("--yes")) {
  console.error(`This changes the database on ${host}. Run again with --yes to go ahead.`);
  process.exit(1);
}

const OWNERS = [
  {
    key: "maria",
    name: "Maria Georgieva (demo)",
    bio: "Flying club owner at Sofia. Happy to help new pilots get to know the 172.",
  },
  {
    key: "stefan",
    name: "Stefan Ivanov (demo)",
    bio: "Archer and DA40 owner, mostly cross-country along the Black Sea coast.",
  },
];
const PILOTS = [
  { key: "elena", name: "Elena Petrova (demo)", total: 420, pic: 350, last90: 14 },
  { key: "georgi", name: "Georgi Dimitrov (demo)", total: 95, pic: 60, last90: 6 },
  { key: "anna", name: "Anna Keller (demo)", total: 1250, pic: 1100, last90: 22 },
];
const AIRCRAFT = [
  {
    owner: "maria",
    registration: "LZ-DMA",
    manufacturer: "Cessna",
    model: "172S Skyhawk",
    type: "C172",
    year: 2006,
    seats: 4,
    fuel: "avgas_100ll",
    base: "LBSF",
    price: 185,
    burn: 34,
    cruise: 118,
    night: true,
    ifr: false,
    description:
      "Well-kept 172S with G1000, based at Sofia. Ideal for local flights and trips to the coast. Headsets available.",
  },
  {
    owner: "stefan",
    registration: "LZ-DMB",
    manufacturer: "Piper",
    model: "PA-28-181 Archer III",
    type: "P28A",
    year: 1998,
    seats: 4,
    fuel: "avgas_100ll",
    base: "LBPD",
    price: 170,
    burn: 36,
    cruise: 120,
    night: true,
    ifr: false,
    description:
      "Comfortable Archer with a Garmin GNS 430 and autopilot. Fuel is included (wet rate).",
  },
  {
    owner: "stefan",
    registration: "LZ-DMC",
    manufacturer: "Diamond",
    model: "DA40 NG",
    type: "DA40",
    year: 2015,
    seats: 4,
    fuel: "jet_a1",
    base: "LBWN",
    price: 215,
    burn: 22,
    cruise: 135,
    night: true,
    ifr: true,
    description: "Modern IFR-equipped DA40 NG with G1000 NXi. Low fuel burn, great visibility.",
  },
  {
    owner: "maria",
    registration: "LZ-DMD",
    manufacturer: "Tecnam",
    model: "P2008 JC",
    type: "P208",
    year: 2019,
    seats: 2,
    fuel: "ul91",
    base: "LBSF",
    price: 135,
    burn: 18,
    cruise: 110,
    night: false,
    ifr: false,
    description:
      "Economical two-seater for hour building and local training flights. Day VFR only.",
  },
];

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => undefined });
const email = (key) => `${key}@${DOMAIN}`;

async function removeDemo() {
  // Bookings, aircraft, reviews, messages… go with the users (ON DELETE CASCADE / SET NULL).
  const gone = await sql`delete from users where email like ${`%@${DOMAIN}`} returning id`;
  return gone.length;
}

async function createUser(key, name, roles) {
  const [user] = await sql`insert into users (name, email, email_verified)
    values (${name}, ${email(key)}, true) returning id`;
  await sql`insert into accounts (user_id, account_id, provider_id, password)
    values (${user.id}, ${user.id}, 'credential', ${await hashPassword(PASSWORD)})`;
  for (const role of roles) {
    await sql`insert into user_roles (user_id, role) values (${user.id}, ${role})
      on conflict do nothing`;
  }
  return user.id;
}

const at = (days, hour) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** Request as the pilot and accept as the owner, like the app does. */
async function booking(pilotId, ownerId, aircraftId, from, to, accept, airfield = "LBSF") {
  const [{ price }] =
    await sql`select price_per_hour as price from aircraft where id = ${aircraftId}`;
  const estimate = Number(price) * 2;
  return sql.begin(async (tx) => {
    await tx`select set_config('app.user_id', ${pilotId}, true)`;
    const [{ id }] = await tx`select public.request_booking(${aircraftId}::uuid,
      tstzrange(${from}, ${to}), ${airfield}, ${airfield}, '{}'::text[], 'local', 1, 2.0,
      'Demo booking: a local flight with a friend.', ${estimate}) as id`;
    if (accept) {
      await tx`select set_config('app.user_id', ${ownerId}, true)`;
      await tx`select public.respond_to_booking(${id}::uuid, 'accept',
        'Keys are in the club house. Have a good flight!')`;
    }
    return id;
  });
}

try {
  const removed = await removeDemo();
  if (removed) console.log(`Removed ${removed} demo accounts and their data.`);
  if (remove) process.exit(0);

  const known = new Set(
    (await sql`select ident from airports where ident in ${sql(AIRCRAFT.map((a) => a.base))}`).map(
      (r) => r.ident,
    ),
  );
  if (!known.has("LBSF")) {
    console.error("Airport LBSF is missing: run npm run airports:import first.");
    process.exit(1);
  }

  const ids = {};
  for (const o of OWNERS) {
    ids[o.key] = await createUser(`owner.${o.key}`, o.name, ["owner"]);
    await sql`update profiles set bio = ${o.bio}, home_airport_ident = 'LBSF' where id = ${ids[o.key]}`;
  }
  for (const p of PILOTS) {
    const id = (ids[p.key] = await createUser(`pilot.${p.key}`, p.name, ["pilot"]));
    await sql`insert into pilot_licences (user_id, type, issuing_state, number, status)
      values (${id}, 'ppl_a', 'BG', ${`BG.FCL.DEMO.${p.key.toUpperCase()}`}, 'verified')`;
    await sql`insert into medicals (user_id, class, issuing_state, valid_until, status)
      values (${id}, 'class2', 'BG', ${at(700, 0).slice(0, 10)}, 'verified')`;
    await sql`insert into pilot_ratings (user_id, kind, code, status) values
      (${id}, 'class', 'SEP_LAND', 'verified'), (${id}, 'privilege', 'NIGHT', 'verified')`;
    await sql`insert into pilot_experience (user_id, total_hours, pic_hours, last_90_days_hours)
      values (${id}, ${p.total}, ${p.pic}, ${p.last90})`;
  }

  const planes = {};
  for (const a of AIRCRAFT) {
    const [plane] = await sql`insert into aircraft (owner_id, registration, manufacturer, model,
        type_designator, year, seats, fuel_type, fuel_burn_lph, cruise_kt, night_vfr, ifr,
        description, home_airport_ident, price_per_hour, currency, price_basis)
      values (${ids[a.owner]}, ${a.registration}, ${a.manufacturer}, ${a.model}, ${a.type},
        ${a.year}, ${a.seats}, ${a.fuel}, ${a.burn}, ${a.cruise}, ${a.night}, ${a.ifr},
        ${a.description}, ${known.has(a.base) ? a.base : "LBSF"}, ${a.price}, 'EUR', 'wet')
      returning id`;
    planes[a.registration] = plane.id;
    await sql`insert into rental_requirements (aircraft_id, min_total_hours, allow_unrated)
      values (${plane.id}, ${a.ifr ? 100 : 50}, true)`;
    // Listed without photos and documents: skip the listing checks for demo aircraft only.
    await sql.begin(async (tx) => {
      await tx`alter table aircraft disable trigger aircraft_check_status`;
      await tx`update aircraft set status = 'listed' where id = ${plane.id}`;
      await tx`alter table aircraft enable trigger aircraft_check_status`;
    });
  }

  // A completed booking (Elena, LZ-DMA) with a confirmed flight log and both reviews.
  const done = await booking(ids.elena, ids.maria, planes["LZ-DMA"], at(20, 8), at(20, 11), true);
  await sql`update bookings set status = 'completed',
    period = tstzrange(${at(-6, 8)}, ${at(-6, 11)}) where id = ${done}`;
  await sql`update calendar_entries set period = tstzrange(${at(-6, 8)}, ${at(-6, 11)})
    where booking_id = ${done}`;
  await sql`insert into flight_logs (booking_id, status, hobbs_start, fuel_start_l, submitted_at,
      confirmed_at, flown_minutes, amount_due)
    values (${done}, 'confirmed', 2451.3, 180, ${at(-6, 12)}, ${at(-5, 9)}, 126, 388.50)`;
  const [log] = await sql`select id from flight_logs where booking_id = ${done}`;
  const minutes = (m) => new Date(Date.parse(at(-6, 8)) + m * 60_000).toISOString();
  await sql`insert into flight_legs (flight_log_id, seq, from_ident, to_ident, block_off,
      engine_start, takeoff_at, landing_at, engine_stop, block_on, landings, hobbs_start, hobbs_end)
    values (${log.id}, 1, 'LBSF', 'LBSF', ${minutes(12)}, ${minutes(10)}, ${minutes(25)},
      ${minutes(122)}, ${minutes(130)}, ${minutes(128)}, 3, 2451.3, 2453.4)`;
  await sql`insert into reviews (booking_id, direction, author_id, subject_user_id,
      subject_aircraft_id, scores, overall, comment, submitted_at)
    values
      (${done}, 'pilot_to_owner', ${ids.elena}, ${ids.maria}, ${planes["LZ-DMA"]},
       ${sql.json({ aircraft_condition: 5, communication: 5, value: 4 })}, 4.67,
       'Spotless aircraft and a very helpful owner. The G1000 briefing before the flight was great.',
       ${at(-5, 12)}),
      (${done}, 'owner_to_pilot', ${ids.maria}, ${ids.elena}, null,
       ${sql.json({ airmanship: 5, punctuality: 5, communication: 5, condition_returned: 5 })}, 5,
       'Careful and well prepared pilot, returned the aircraft clean and on time. Welcome back!',
       ${at(-4, 18)})`;
  // Publishing fires the trigger that updates the rating averages.
  await sql`update reviews set published_at = ${at(-4, 18)} where booking_id = ${done}`;
  await sql`update reviews set reply = 'Thank you, Elena! Blue skies.', replied_at = ${at(-3, 9)}
    where booking_id = ${done} and direction = 'pilot_to_owner'`;

  // An upcoming accepted booking and an open request.
  const varna = known.has("LBWN") ? "LBWN" : "LBSF";
  const upcoming = await booking(
    ids.anna,
    ids.stefan,
    planes["LZ-DMC"],
    at(5, 7),
    at(5, 12),
    true,
    varna,
  );
  await booking(ids.georgi, ids.maria, planes["LZ-DMD"], at(9, 9), at(9, 11), false);

  // A conversation about the upcoming booking.
  await sql.begin(async (tx) => {
    await tx`select set_config('app.user_id', ${ids.anna}, true)`;
    const [{ id }] = await tx`select public.start_conversation(${planes["LZ-DMC"]}::uuid,
      ${upcoming}::uuid, 'Hi Stefan, is the aircraft fuelled to tabs or full?') as id`;
    await tx`select set_config('app.user_id', ${ids.stefan}, true)`;
    await tx`select public.send_message(${id}::uuid,
      'Hi Anna, it will be full. See you at Varna, I will be at the aeroclub from 06:30 UTC.')`;
  });

  console.log(`Demo data added on ${host}:`);
  for (const o of OWNERS) console.log(`  owner  owner.${o.key}@${DOMAIN}`);
  for (const p of PILOTS) console.log(`  pilot  pilot.${p.key}@${DOMAIN}`);
  console.log(`  password: ${process.env.DEMO_PASSWORD ? "(DEMO_PASSWORD)" : PASSWORD}`);
} catch (e) {
  console.error("Seeding failed:", e.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
