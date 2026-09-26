#!/usr/bin/env node
/**
 * Creates the Phase 1 milestones, labels and issues on GitHub from docs/implementation-plan.md.
 *
 * Usage (from the repo root, after `gh auth login`):
 *   node scripts/create-github-issues.mjs --dry-run   # preview, changes nothing
 *   node scripts/create-github-issues.mjs             # create
 *
 * Safe to re-run: existing milestones, labels and issues (matched by title) are skipped.
 */
import { execFileSync } from "node:child_process";

const DRY = process.argv.includes("--dry-run");

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}
function lines(out) {
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

const DOD = [
  "RLS added/updated for new tables, with a test that another user can't access the data",
  "`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass",
  "Works on a phone-sized screen",
];

const MILESTONES = [
  ["M0 Foundations", "Tooling, Supabase, Vercel, CI, app shell"],
  ["M1 Accounts & profiles", "ACC-1…5"],
  ["M2 Airports", "European airport reference data + picker"],
  ["M3 Pilot verification", "VER-1…6, ADM-1"],
  ["M4 Aircraft listings", "LST-1…8, RAT-6/7"],
  ["M5 Search & availability", "SRC-1…5, RAT-8"],
  ["M6 Booking", "BKG-1…10, MSG-3"],
  ["M7 Ratings", "RAT-1…5"],
  ["M8 Messaging", "MSG-1, MSG-2"],
  ["M9 Admin & trust", "ADM-2…4"],
  ["M10 Launch readiness", "Legal, security, monitoring, production, beta"],
];

const LABELS = [
  ["phase-1", "0E8A16", "Phase 1 (MVP)"],
  ["size:S", "C2E0C6", "A few hours"],
  ["size:M", "FBCA04", "1–2 sessions"],
  ["size:L", "D93F0B", "3+ sessions"],
  ["priority:should", "BFD4F2", "Should-have: can slip to after launch"],
  ["database", "5319E7", "Schema, RLS, SQL functions"],
  ["ui", "1D76DB", "Pages and components"],
  ["infra", "6A737D", "Tooling, CI, hosting"],
];

// [milestoneIndex, title, size, labels[], requirements, what, doneWhen[]]
const ISSUES = [
  // M0
  [0, "Set up Tailwind CSS v4 and shadcn/ui", "S", ["ui", "infra"], "—", "Install Tailwind v4 and initialise shadcn/ui. Replace the plain CSS in globals.css with theme tokens (light + dark).", ["Button, Input, Card, Dialog components added", "Home page uses them"]],
  [0, "Add ESLint and Prettier with a lint script", "S", ["infra"], "—", "Add ESLint (Next.js config) and Prettier. Add `lint` and `format` scripts.", ["`npm run lint` passes on the repo", "CLAUDE.md commands updated"]],
  [0, "Connect the app to a Supabase dev project (EU)", "M", ["infra", "database"], "§7 NFR", "Create the Supabase project in Frankfurt. Add @supabase/ssr with browser/server clients in lib/supabase and session refresh in proxy.ts. Env vars go in .env.local and .env.example.", ["App reads from Supabase on the server", "Service-role client lives in a server-only module", "No secrets committed"]],
  [0, "Set up Supabase CLI migrations and generated types", "S", ["infra", "database"], "—", "Link the repo to the Supabase project. Add supabase/migrations, supabase/seed.sql and an `npm run db:types` script that writes lib/types/database.ts.", ["First migration enables btree_gist, postgis, pg_cron", "Types generate without errors", "CLAUDE.md documents the migration workflow"]],
  [0, "Deploy to Vercel (fra1) with preview deployments", "S", ["infra"], "—", "Import the repo into Vercel, set the function region to fra1, and add env vars for preview and production.", ["main deploys automatically", "Branches/PRs get preview URLs"]],
  [0, "GitHub Actions CI: typecheck, lint, test, build", "S", ["infra"], "—", "Add a workflow that runs on every push and PR.", ["CI green on main", "Status badge in README"]],
  [0, "Set up Vitest and Playwright with smoke tests", "S", ["infra"], "—", "Add Vitest for unit tests and Playwright for e2e, each with one passing test. Add `test` and `test:e2e` scripts.", ["Both run locally and in CI (e2e can be local-only at first)"]],
  [0, "App shell: header, navigation, footer, responsive layout", "M", ["ui"], "—", "Route groups (marketing)/(auth)/(app)/admin. Header with logo placeholder, nav and login button. Mobile menu.", ["Looks good at 375 px and desktop", "Dark mode works"]],
  // M1
  [1, "Email sign-up, login, logout, email verification and password reset", "M", ["ui"], "ACC-1", "Supabase Auth email/password flows with Zod-validated forms.", ["Unverified users are prompted to verify", "Protected routes redirect to login", "Playwright test for sign-up → login"]],
  [1, "Sign in with Google", "S", ["ui"], "ACC-1", "Google OAuth via Supabase. Apple comes later.", ["New Google users get a profile", "Works on the preview deployment"]],
  [1, "Profiles table, RLS and profile edit page", "M", ["database", "ui"], "ACC-3", "`profiles` created by trigger on sign-up. Edit name, photo (storage), home airfield (placeholder until M2).", ["Users can only edit their own profile", "Private fields never exposed publicly"]],
  [1, "Roles: switch on pilot / owner", "S", ["database", "ui"], "ACC-2", "`user_roles` table and a settings UI to enable roles. Navigation adapts to roles.", ["Admin role can only be granted in the database"]],
  [1, "Public profile page", "S", ["ui"], "ACC-3", "/u/[id] shows name, photo, home base, roles, member since, badges and rating summary (placeholders until M3/M7).", ["No private data on the page"]],
  [1, "Account deletion and data export (GDPR)", "M", ["database", "ui"], "ACC-4", "Export my data as JSON. Delete my account (anonymise reviews, remove documents).", ["Deletion removes storage files", "Export includes all my rows"]],
  [1, "Language and unit preferences with i18n setup", "M", ["ui", "priority:should"], "ACC-5", "Set up i18n (EN first, BG-ready) and a units preference (kg/lb, L/USG).", ["All UI strings go through the i18n helper from now on"]],
  // M2
  [2, "Import European airports from OurAirports with timezones", "M", ["database"], "LST-4, SRC-1", "Script to download OurAirports CSVs, filter to Europe (keep ICAO airfields and airstrips), work out the IANA timezone from coordinates, and load the `airports` table (geography point).", ["Re-runnable import script in scripts/", "LBSF, LBPD, LBWN present with correct timezone"]],
  [2, "Airport picker component", "S", ["ui"], "LST-4, SRC-1", "Autocomplete by ICAO code, name or city. Reusable in forms and search.", ["Keyboard accessible", "Used for home airfield on profile"]],
  // M3
  [3, "Pilot credentials data model and RLS", "M", ["database"], "VER-1…4", "Tables: pilot_licences, pilot_ratings, medicals, experience, experience_by_type, documents. Private buckets pilot-documents and medical.", ["Medical rows/files are readable only by the pilot and admins", "RLS tests"]],
  [3, "Credentials UI with private document upload", "L", ["ui"], "VER-1…4", "Profile → Credentials: add licence, ratings/privileges, medical and experience, with document uploads and status badges.", ["Upload via signed URLs", "Shows pending/verified/rejected + reason"]],
  [3, "Admin verification queue for pilot documents", "M", ["ui", "database"], "VER-5, ADM-1", "Admin page listing pending documents, a viewer via short-lived signed URL, and verify/reject with a reason.", ["Every admin view/decision logged in admin_actions", "Pilot notified of the result"]],
  [3, "Credential expiry: validity checks and 30-day reminders", "M", ["database"], "VER-6", "SQL helpers for 'valid on date X'. Daily pg_cron job marks expired items and queues reminders.", ["Expired medical/licence flagged on profile", "Tests for the date logic"]],
  // M4
  [4, "Aircraft data model and RLS", "M", ["database"], "LST-1, 2, 4, 5, 7", "Tables: aircraft, aircraft_photos, aircraft_documents, rental_requirements. Status enum.", ["Only the owner edits. Public can read listed aircraft only", "RLS tests"]],
  [4, "Create/edit aircraft listing form", "L", ["ui"], "LST-1…5", "Multi-step form: basics → equipment → home base → pricing (wet/dry, Hobbs/tach/block, weekend price, minimum hours) → cancellation policy → review.", ["Draft can be saved and resumed", "Zod validation shared with the server"]],
  [4, "Aircraft photo upload and gallery", "M", ["ui"], "LST-3", "Upload 1–20 photos, reorder, set cover. Resize/compress in the browser.", ["Gallery on the listing page works on mobile"]],
  [4, "Aircraft documents, admin verification and auto-unlist on expiry", "M", ["database", "ui"], "LST-6, ADM-1", "Upload CofA, ARC and insurance with expiry dates. Admin queue as in M3. Daily job unlists aircraft with an expired ARC or insurance and notifies the owner.", ["Aircraft can't be listed until the ARC and insurance are verified"]],
  [4, "Rental requirements settings", "M", ["ui", "database"], "RAT-6, RAT-7", "Per aircraft: min pilot rating, allow unrated (optionally only with a checkout flight), licence types, required ratings, minimum hours (total / type / 90 days), min age.", ["Requirements shown on the aircraft page"]],
  [4, "Owner dashboard: my aircraft", "S", ["ui"], "LST-7", "List of my aircraft with status (draft/listed/paused/unlisted/grounded) and quick actions.", ["Pause/unpause works"]],
  [4, "POH, checklists and weight & balance uploads", "S", ["ui", "priority:should"], "LST-8", "Owner uploads reference documents, visible to pilots with an accepted booking.", ["Not visible to the public"]],
  // M5
  [5, "Calendar entries with no-overlap constraint", "M", ["database"], "SRC-5, BKG-5", "calendar_entries table with a tstzrange period and an exclusion constraint on active entries (see plan §4.1).", ["SQL test proves two overlapping active entries are rejected"]],
  [5, "Owner calendar UI", "L", ["ui"], "SRC-5", "Week/month calendar per aircraft. Add/remove own-use, maintenance and unavailable blocks. Bookings shown read-only.", ["Times in airport-local with UTC shown", "Usable on mobile"]],
  [5, "Eligibility check function", "M", ["database"], "RAT-8, VER-6, BKG-1", "check_eligibility(pilot, aircraft, period) returns failed requirements with reasons (plan §4.2).", ["Covers every requirement type in RAT-6/7 and credential validity", "Unit tests for each rule"]],
  [5, "Search page: location, dates, filters, list view", "L", ["ui", "database"], "SRC-1, SRC-2, SRC-3", "Search RPC (PostGIS radius + free-in-period + filters, incl. 'I meet the requirements'). Results list with card, price, rating, distance.", ["Result in < 2 s with seed data", "Filters reflected in the URL (shareable)"]],
  [5, "Map view for search results", "M", ["ui"], "SRC-3", "MapLibre map with aircraft markers grouped by airport. Choose the tile provider.", ["List/map toggle on mobile"]],
  [5, "Aircraft detail page with availability calendar", "M", ["ui"], "SRC-4", "Specs, gallery, owner card, requirements with my eligibility, cancellation policy, availability calendar and a 'Request booking' button.", ["Shows exactly which requirement fails"]],
  // M6
  [6, "Booking request flow with price estimate", "L", ["ui", "database"], "BKG-1, BKG-2, BKG-5", "request_booking RPC: checks eligibility, creates booking + calendar hold, expires_at = +24 h. Form: slot, purpose, destinations, passengers. Estimate shown and 'pay the owner directly' note.", ["Can't request if ineligible or the slot is taken", "Playwright test"]],
  [6, "Owner: accept, decline or propose another time; 24 h expiry", "M", ["ui", "database"], "BKG-3, BKG-5", "Owner requests inbox. Actions update the booking and calendar. pg_cron expires stale requests.", ["Hold released on decline/expiry"]],
  [6, "Cancellation with policy display", "M", ["ui", "database"], "BKG-6", "Both sides can cancel with a reason. Late cancellations recorded on the profile.", ["Policy shown before requesting and before cancelling"]],
  [6, "Check-out / check-in: readings, fuel, final amount", "L", ["ui", "database"], "BKG-7", "Pilot records start/end Hobbs/tach, fuel and photos. The owner confirms. Final time and amount due calculated.", ["Booking becomes completed after owner confirmation"]],
  [6, "Defect reporting and grounding", "M", ["ui", "database"], "BKG-8", "Report defects at check-in (or anytime). The owner is notified and can ground the aircraft, which blocks bookings until cleared.", ["Grounded aircraft hidden from search"]],
  [6, "Notifications: in-app and email, 24 h reminder", "L", ["ui", "database", "infra"], "BKG-9, MSG-3", "notifications table + bell UI. Resend emails for request, accept, decline, expire, reminder and check-in. Per-channel settings.", ["Emails in the user's language", "Unsubscribe/settings link"]],
  [6, "Checkout-flight requirement", "S", ["ui", "priority:should"], "BKG-10", "Owner can require an instructor checkout before a first solo rental. The pilot sees it in the requirements.", []],
  [6, "Instant booking", "S", ["ui", "priority:should"], "BKG-4", "Optional per aircraft: auto-accept for eligible pilots who have flown it before.", []],
  // M7
  [7, "Reviews data model with double-blind publishing", "M", ["database"], "RAT-1…4", "reviews table, publish trigger when both submitted, 14-day pg_cron publish, rating aggregates by trigger.", ["RLS: unpublished reviews visible only to their author", "SQL tests for reveal rules"]],
  [7, "Review forms and display", "M", ["ui"], "RAT-1, RAT-2", "Prompt after a completed booking. Category scores + comment. Show reviews and averages on the profile and aircraft pages.", ["Only one review per side per booking"]],
  [7, "Owner reply and review reporting", "S", ["ui"], "RAT-5", "One public reply per review. 'Report' sends it to the admin queue.", []],
  // M8
  [8, "Conversations and messages", "M", ["ui", "database"], "MSG-1", "Threads linked to a booking or listing. Unread counts. Email notification for new messages.", ["Only participants can read"]],
  [8, "Reveal contact details after booking acceptance", "S", ["ui", "database"], "MSG-2", "Phone/email visible to the other party only for accepted bookings.", []],
  // M9
  [9, "Admin tools: suspend users, unlist aircraft, hide reviews, audit log", "M", ["ui", "database"], "ADM-2", "Admin pages with actions and a searchable audit log.", ["Suspended users can't log in or book"]],
  [9, "Report flow and admin report queue", "M", ["ui", "database"], "ADM-3", "Report button on users, listings, reviews and messages. Queue with statuses.", []],
  [9, "Admin dashboard metrics", "S", ["ui"], "ADM-4", "Sign-ups, listings, bookings, cancellations and reports over time.", []],
  // M10
  [10, "Terms of service, privacy policy and cookie pages", "M", ["ui"], "Req. §7, §9", "Draft pages (lawyer review before launch). Consent at sign-up.", ["Linked in the footer and at sign-up"]],
  [10, "Security review: RLS, storage and server actions", "M", ["database"], "Req. §7", "Go through every table and bucket policy and every server action with Claude. Fix gaps.", ["Checklist documented in docs/"]],
  [10, "Error monitoring and privacy-friendly analytics", "S", ["infra"], "—", "Sentry for errors. Cookie-less analytics.", []],
  [10, "Accessibility pass on main flows", "M", ["ui"], "Req. §7", "Check sign-up, search, booking and review flows against WCAG 2.1 AA basics.", []],
  [10, "Production environment: Supabase prod, backups, custom domain", "M", ["infra"], "—", "Create the prod project (Frankfurt), run migrations, set up backups, point the domain at Vercel production.", []],
  [10, "Demo data and private beta with first owners", "M", ["database"], "Req. §2", "Realistic seed data for demos. Onboard the first 10–20 owners and collect feedback.", []],
];

// ---------------------------------------------------------------------------

if (!DRY) {
  try {
    gh(["auth", "status"]);
  } catch {
    console.error("Not logged in to GitHub CLI. Run: gh auth login");
    process.exit(1);
  }
}

const existingMilestones = new Set(DRY ? [] : lines(gh(["api", "repos/{owner}/{repo}/milestones?state=all&per_page=100", "--jq", ".[].title"])));
const existingIssues = new Set(DRY ? [] : lines(gh(["issue", "list", "--state", "all", "--limit", "1000", "--json", "title", "--jq", ".[].title"])));

console.log("Labels…");
for (const [name, color, description] of LABELS) {
  if (DRY) console.log(`  label ${name}`);
  else gh(["label", "create", name, "--color", color, "--description", description, "--force"]);
}

console.log("Milestones…");
for (const [title, description] of MILESTONES) {
  if (existingMilestones.has(title)) { console.log(`  skip  ${title}`); continue; }
  if (DRY) console.log(`  create ${title}`);
  else gh(["api", "repos/{owner}/{repo}/milestones", "-f", `title=${title}`, "-f", `description=${description}`]);
}

console.log("Issues…");
let created = 0;
for (const [m, title, size, labels, reqs, what, done] of ISSUES) {
  if (existingIssues.has(title)) { console.log(`  skip  ${title}`); continue; }
  const body = [
    `**Requirements:** ${reqs} — see [docs/business-requirements.md](../blob/main/docs/business-requirements.md)`,
    `**Plan:** [docs/implementation-plan.md](../blob/main/docs/implementation-plan.md) · **Size:** ${size}`,
    "",
    "### What",
    what,
    "",
    "### Done when",
    ...done.map((d) => `- [ ] ${d}`),
    ...DOD.map((d) => `- [ ] ${d}`),
  ].join("\n");
  const allLabels = ["phase-1", `size:${size}`, ...labels].join(",");
  const milestone = MILESTONES[m][0];
  if (DRY) console.log(`  create [${milestone}] ${title}  (${allLabels})`);
  else {
    const url = gh(["issue", "create", "--title", title, "--body", body, "--milestone", milestone, "--label", allLabels]).trim();
    console.log(`  ${url}  ${title}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500); // avoid GitHub rate limits
  }
  created++;
}
console.log(`\nDone. ${created} issue(s) ${DRY ? "would be " : ""}created.`);
