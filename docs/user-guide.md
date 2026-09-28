# ownAplane user guide

> **For:** pilots, aircraft owners and admins of [ownaplane.eu](https://ownaplane.eu).
> **Covers:** everything live as of 28 September 2026 (milestones M1–M6). Ratings and reviews,
> messaging and weather warnings are coming next; see [Coming soon](#11-coming-soon).
> **Keep it current:** update this guide in the same change as the feature.

ownAplane is a European general aviation marketplace. Pilots rent aircraft directly from their
owners. Owners decide who may fly their aircraft, and every pilot's licence, ratings and medical
are checked by our team before they count. EASA rules and terms apply throughout (LAPL/PPL,
ARC, Part-ML).

**What ownAplane is not.** It doesn't replace official records: the aircraft's journey and
technical logs, certificates of release to service, your pilot logbook, ATC clearances or
customs. It also doesn't take payments yet: you pay the owner directly, as agreed between you.

---

## Contents

1. [Getting started](#1-getting-started)
2. [Your account](#2-your-account)
3. [Pilots: credentials](#3-pilots-credentials)
4. [Pilots: finding and booking an aircraft](#4-pilots-finding-and-booking-an-aircraft)
5. [Pilots: flying: check-out, flight log, check-in](#5-pilots-flying-check-out-flight-log-check-in)
6. [Owners: listing an aircraft](#6-owners-listing-an-aircraft)
7. [Owners: bookings, flight logs and your aircraft's history](#7-owners-bookings-flight-logs-and-your-aircrafts-history)
8. [Notifications and emails](#8-notifications-and-emails)
9. [Admins: verification](#9-admins-verification)
10. [Rules that apply everywhere](#10-rules-that-apply-everywhere)
11. [Coming soon](#11-coming-soon)
12. [Questions and answers](#12-questions-and-answers)

---

## 1. Getting started

### Sign up and log in

1. Go to **Sign up**, enter your name, email and a password (at least 8 characters) and accept
   the terms.
2. Choose how you'll use the app: **I'm a pilot**, **I own an aircraft**, or both. You can change
   this any time in **Account → General → How you'll use the app**.
3. Log in with your email and password. Forgot it? Use **Forgot password** on the login page and
   follow the link in the email.

**Google sign-in.** If it's switched on for the site, you can sign up with Google. To add Google
to an existing email/password account, log in and use **Account → General → Sign-in methods**.
(For your safety we never link Google to an account automatically.)

### The menu

- **Find aircraft**: search for aircraft to rent.
- **List your aircraft**: your aircraft as an owner (**My aircraft**).
- **🔔 Bell**: your notifications, with the number of unread ones.
- **Your picture** opens the account menu: **Dashboard**, **Bookings**, **Account**, **Public
  profile**, **Admin** (admins only) and **Log out**.

On a phone the same items are behind the **☰** menu button; the bell stays visible.

### The dashboard

Your starting point after logging in: what's missing from your profile, the state of your pilot
credentials, and shortcuts to your bookings and aircraft.

---

## 2. Your account

**Account** has two tabs: **General** and **Pilot credentials** (see [section 3](#3-pilots-credentials)).

### Profile

- **Profile picture.** Upload a photo (JPG, PNG or WebP, up to 2 MB), or pick one of our ten
  ready-made aviation avatars under **Or choose one of ours** (light aircraft, biplane, jet,
  helicopter, glider, balloon, propeller, windsock, compass rose, headset). Choosing a ready-made
  one removes your uploaded photo. **Remove** goes back to your initials.
- **Display name**, **home airfield** (chosen from the airport list) and a short **bio**.
- **View public profile** shows what others see: name, picture, home airfield, bio, your
  verified licence types and ratings, and how many bookings you cancelled late. Licence numbers,
  documents and medical details are never public.

### Preferences

- **Language:** English or Bulgarian, for the app and for emails.
- **Units:** metric (kg, litres) or imperial (lb, US gallons), for weights and fuel. Oil is always
  shown in the aircraft's own dipstick unit (US quarts or litres).

### Security and data

- **Change password** and **Sign-in methods** (link Google).
- **Download my data** gives you everything we store about you as a JSON file (without passwords
  or login tokens).
- **Delete account** removes your account, profile, credentials, documents and aircraft for good.
  You confirm with your password and by typing a confirmation word.

---

## 3. Pilots: credentials

**Account → Pilot credentials.** Owners set requirements for their aircraft (licence, ratings,
hours…), and the app checks yours against them. Only **verified and valid** credentials count.

### What you add

| Section | What to enter |
|---|---|
| **Licences** | Type (LAPL(A), PPL(A), CPL(A), ATPL(A), MPL, other), issuing state, number, issue and expiry dates, and a scan or photo. |
| **Ratings and privileges** | Class ratings (e.g. SEP land, MEP land, TMG), privileges (e.g. Night, IR) and type ratings (ICAO designator, e.g. C510), with expiry date and a scan. |
| **Medical** | Class (Class 1, Class 2, LAPL), issuing state, valid until, and a scan. |
| **Experience** | Total hours, hours as PIC, hours in the last 90 days, hours per aircraft type, and (optionally) your date of birth for owners' minimum-age rules. |

Documents are PDF, JPG or PNG up to 4 MB. Big photos are shrunk in your browser before upload.

### Verification

- Each item starts as **Pending**. Our team checks the document and marks it **Verified** or
  **Rejected** (with the reason). You get an email either way.
- **Editing a verified item sends it back to Pending**, so it's checked again.
- **Expiry:** you get a reminder email 30 days before a licence, rating or medical expires. An
  expired item no longer counts.

### Privacy

Your medical is special-category data under GDPR: only you and our verification team see it.
Owners never see your documents, numbers or medical details. For their aircraft they only see a
**yes/no: "meets your requirements"**. Your public profile shows only verified licence types and
ratings.

---

## 4. Pilots: finding and booking an aircraft

### Search

**Find aircraft** lets you search by:

- **Airfield** (from the airport list) and **Within** a radius in km.
- **From / Until**: local time at the chosen airfield. With dates, only aircraft free for the
  whole time are shown.
- **More filters:** minimum seats, maximum price per hour, and **Only aircraft I can rent**
  (checks your verified credentials against each owner's requirements).
- **Sort** by distance, price, rating or newest.
- **List** or **Map** view. On the map, each airfield has a marker with the number of aircraft;
  click it to see them.

A search at night only shows aircraft approved for night VFR.

### The aircraft page

Photos, specifications, equipment, price and terms, the home base, the owner, a calendar of
free and busy times (you see only *busy*, never other people's details) and the owner's
**requirements**.

**Can I rent this?** tells you, for the times you picked, whether you meet the requirements. If
not, it lists the reasons and links to your pilot credentials. Some things are **conditions**
rather than refusals, for example a checkout flight with an instructor (see below).

### Requesting a booking

**Request booking** on the aircraft page opens the form:

- **From / Until** (local time at the departure airfield; UTC is shown alongside).
- **Departure** and **arrival** airfields, and optional **stops**.
- **Purpose** (local flight, cross-country, training, other), **passengers** (up to seats − 1),
  **planned flight time** and a **message to the owner**.
- A live **estimate**: planned hours × price per hour (weekend price and minimum hours per day
  apply), plus fuel on a dry rate. The final amount comes from the flight log.
- The owner's **cancellation policy**.

**Night rule.** If any part of the booking falls between 30 minutes after sunset and 30 minutes
before sunrise at the departure, arrival or any stop, it's a night flight: the aircraft must be
approved for night VFR and you need a verified, valid Night rating.

If you don't meet the requirements, the form lists why and links to **Go to your pilot
credentials**. If the time is taken, you're told so.

### What happens next

- The owner has **24 hours** to answer (or until the booking starts, if that's sooner). No answer
  means the request **expires** and the time is free again.
- The owner **accepts**, **declines**, or **declines and suggests another time**. In that case
  the booking page has a button to request the suggested time.
- **Instant booking:** if the owner has switched it on, you've **completed a rental of this
  aircraft before**, you meet every requirement and no checkout flight is pending, your request is
  **accepted at once** ("Booked instantly").

Your bookings are under **Bookings** (**My rentals**), each with its status and full history.

### Cancelling

On the booking page, **Cancel booking** (with a reason) is possible until the booking starts. The
owner's policy says how long before the start you can cancel for free:

| Policy | Free cancellation until |
|---|---|
| Flexible | 24 hours before |
| Moderate | 3 days before |
| Strict | 7 days before |

Cancelling an accepted booking later than that counts as a **late cancellation**, and the number
of late cancellations is shown on your public profile. Cancelling a request that hasn't been
answered is always free.

### Before you fly

- **Reminder:** you and the owner get a reminder the day before (within 36 hours of the start).
- **Known items:** if the owner has marked something about the aircraft as a known item (e.g.
  "left mag drop 150 rpm"), it's shown on your booking and flight log. Read them before you fly.
- **Checkout flight:** if the owner asks for one, the booking says so. Arrange it with the owner;
  once they record it, you won't be asked again for that aircraft.
- **Grounded aircraft:** if the owner grounds the aircraft, your booking shows a warning and you
  can't check out until it's cleared.

---

## 5. Pilots: flying: check-out, flight log, check-in

Every rental has a **flight log**: a record between you and the owner. It is **not** the
aircraft's journey or technical log, and not your pilot logbook.

### Check-out

From **2 hours before** the booked time, your booking has a **Check out** button. It opens the
flight log and puts the booking **In progress**. Enter what you find before the first flight:
Hobbs and tach, fuel on board, oil level, and optionally a photo of the meters.

### Legs

Add one **leg** per flight (**Add leg**), for example LBSF → LBPD → LBSF as two legs:

- **From / To** airfields and the **date**.
- **Block off, engine start, take-off, landing, engine stop, block on**: local time at each
  airfield (departure times at the departure airfield, arrival times at the arrival airfield).
  Take-off and landing are optional. Times past midnight are handled.
- **Landings**, **Hobbs** and **tach** at start and end, **fuel** and **oil** before and after.

The app refuses times out of order, legs longer than 24 hours and meters that go backwards. You
can edit or delete legs until you check in.

### Fuel and oil added

**Add fuel or oil** for every refuelling or oil top-up: airfield, quantity, fuel type or oil
grade, **price paid** (in the booking's currency), **who paid** (you, or the owner's account) and
the **receipt** (optional; the owner can open it). How it counts in the amount due:

- **Wet rate:** fuel you paid for is taken off.
- **Dry rate:** fuel from the owner's account is added.
- **Oil** is part of both rates, so oil you paid for is always taken off.
- Entries without a price don't count, and the page says so.

### Remarks and PIREPs

Under **Remarks and PIREPs**, note anything the owner or the next pilot should know that isn't a
defect: about the **aircraft** ("COM2 scratchy"), the **weather** or an **airfield**.

### Report a defect

Something that may affect airworthiness? Use **Report a defect** (on the booking or the flight
log): how serious it is (**minor**, **major**, or **unsafe**: shouldn't fly), what's wrong, and
an optional photo. The owner is emailed straight away.

### Check-in

When you're back, **Check in and send to the owner**. The summary shows the **flown time** (on
the aircraft's time basis: Hobbs, tach or block time), the **billed hours** (at least the owner's
minimum per day) × rate, the **fuel and oil** adjustment and the **amount due**. After check-in
you can't change the log, unless the owner asks for a **correction**: then it opens again with
their note, and you send it once more.

When the owner **confirms**, the booking is **Completed**. Pay the owner directly.

### Export your flights

**Bookings → Export my flights (CSV)** downloads all legs from your sent and confirmed flight
logs in logbook order (date, departure and off-block time, arrival and on-block time in UTC,
type, registration, block time, landings), to help you fill in your pilot logbook.

---

## 6. Owners: listing an aircraft

**List your aircraft → Add aircraft.** The listing is saved as a **draft** step by step; pilots
don't see it until you publish it.

### Sections

| Tab | What it's for |
|---|---|
| **Overview** | Status, what's still missing, publish/pause/unlist, view the public listing, delete. |
| **Calendar** | Your own use, maintenance and unavailable times; all bookings. |
| **Details** | Registration, manufacturer, model, ICAO type, category, year, seats, engine, fuel type and burn, cruise speed, useful load, endurance. |
| **Equipment** | Avionics, transponder, night VFR / IFR approval. |
| **Home base** | Airfield from the airport list. |
| **Pricing** | Price per hour, weekend price, minimum hours per day, currency, fuel (wet/dry), time measured by (Hobbs, tach, block), oil unit, cancellation policy. |
| **Photos** | Up to 20; big photos are shrunk in your browser. |
| **Documents** | CofA, ARC and insurance (checked by our team), plus reference documents (POH, checklists, weight & balance). |
| **Requirements** | Who may rent it (below). |
| **Defects** | Reported defects; ground the aircraft. |
| **Remarks** | Everything pilots noted; known items. |
| **Usage** | Hours, landings, fuel and oil from confirmed flight logs; CSV export. |

### Publishing and status

You can **publish** once the aircraft has a home base, a price, at least one photo and a
**verified, unexpired ARC and insurance**. Then:

| Status | Meaning |
|---|---|
| **Listed** | Pilots can find and book it. |
| **Paused** | Hidden for now; list it again any time. |
| **Unlisted** | Not visible to pilots. |
| **Grounded** | Pilots can't book it, and bookings can't be accepted or checked out until you list it again. |

**Expiring documents.** You get a reminder 30 days before the ARC, insurance or CofA expires. If
the ARC or insurance expires, the aircraft is **unlisted automatically** and you're emailed.
Upload the renewed document (the old one counts until the new one is verified), then list it
again.

### Requirements

- **Pilot rating:** a minimum average rating from earlier rentals; whether **pilots without
  reviews may ask**, optionally **only after a checkout flight with an instructor**.
- **Every pilot new to this aircraft needs a checkout flight with an instructor first.**
- **Licences** you accept (none ticked = any verified licence).
- **Ratings and privileges** the pilot needs (e.g. SEP land, Night), and a **type rating** if the
  aircraft needs one.
- **Experience:** minimum total hours, hours on this type, hours in the last 90 days, and
  **minimum age**.
- **Instant booking** for pilots who have flown this aircraft before.

Automatic rules on top of yours: aeroplanes need a SEP/MEP (land) class rating, TMGs a TMG or SEP
(land) rating; night flights need night VFR approval and a Night rating; every credential must be
valid on the last day of the rental.

### Calendar

Block time for **own use**, **maintenance** or **unavailable**, with an optional note. Blocks and
bookings can never overlap. Pilots only see that a time is busy.

---

## 7. Owners: bookings, flight logs and your aircraft's history

### Answering requests

**Bookings → For my aircraft.** On each request you see the flight, the pilot and a **yes/no:
"meets your requirements"** (never their documents). You have **24 hours** (or until the start):

- **Accept**: the time is booked.
- **Decline**, optionally with a note, or **decline and suggest another time**.

You can't accept while the aircraft is grounded. You can cancel an accepted booking too (with a
reason); the pilot is told.

### Checkout flights

If a checkout flight is required, the booking says so. When it's done, fill in **Checkout flight
done?** on the booking (date, instructor, note) and **Record checkout flight**. That pilot then
doesn't need another checkout on this aircraft.

### Confirming the flight log

When the pilot checks in, you get a notification. On the flight log you see everything they
entered (check-out readings and photo, legs, fuel and oil with receipts, remarks) and the
**amount due**. Then:

- **Confirm log and amount**: the booking is completed and any unused booked time is freed.
- **Ask for a correction**, with a note: the pilot can change the log and send it again.

### Defects and grounding

A reported defect is emailed to you straight away and listed under **Defects** (who reported it,
when, the booking and the photo). You can also report one yourself.

- **Ground the aircraft** if it shouldn't fly. While grounded, pilots can't book it, you can't
  accept requests and accepted bookings can't be checked out; their pilots see a warning.
- **Mark as fixed** with a note of what was done.
- **Clear grounding and list again** when it's airworthy (the listing checks still apply).

This is a record between you and your renters, not the aircraft's technical log: airworthiness
and certificates of release to service stay with you and your maintenance organisation.

### Remarks and known items

**Remarks** lists everything pilots noted, with a link to each booking. **Mark as known item**
on an aircraft remark to show it to every pilot with a booking of the aircraft (without who wrote
it), and **Mark as fixed** when it's sorted.

### Usage history

**Usage** shows, from confirmed flight logs: flights, flown time (on your time basis), block and
engine time, landings, fuel and oil used, and **oil per engine hour** (a rising figure can be an
early sign of engine trouble). You get a total, one table per month and one per pilot.
**Export legs (CSV)** downloads every leg (UTC times, litres).

---

## 8. Notifications and emails

You're told about everything that happens to your bookings, **in the app** (🔔 bell, unread count,
**Notifications** page) and **by email**:

| Event | Who is told |
|---|---|
| New request, instant booking | Owner |
| Accepted, declined, other time suggested | Pilot |
| Request expired | Pilot and owner |
| Booking cancelled | The other party |
| Checked out, flight log sent | Owner |
| Correction requested, flight log confirmed | Pilot |
| Defect reported | Owner (with a detailed email) |
| Reminder before the booking | Pilot and owner |

Also by email: credential and aircraft document decisions, expiry reminders, and when an aircraft
is unlisted because a document expired. Opening **Notifications** marks everything read.

---

## 9. Admins: verification

Admins are made with `npm run admin:grant -- email@example.com` (and removed with `--revoke`); the
person must have signed up first.

- **Admin → Verifications** lists pilot credentials and aircraft documents waiting for review.
- Open an item, look at the document and **Verify** or **Reject** with a reason (sent to the
  person).
- Admins can't review their own credentials or aircraft.
- Every document an admin opens, and every decision, is written to the audit log.

---

## 10. Rules that apply everywhere

- **Times** are stored in UTC and shown in the airfield's local time, with UTC alongside on
  bookings.
- **Airports** come from the OurAirports list (7,392 European airfields). They're shown by ICAO
  code, or a local code for small airfields without one (e.g. `BG-0004`), and always picked from
  the list.
- **Units:** your choice for weights and fuel; oil in the aircraft's dipstick unit; distances in
  km.
- **Money:** prices and amounts are in the aircraft's currency. **Payments happen outside the
  app**, directly between pilot and owner.
- **Official records:** the app never replaces the journey/technical log, CRS, your logbook, ATC
  or customs.

---

## 11. Coming soon

- **Ratings and reviews** (M7): pilots and owners rate each other after a rental.
- **Messaging** (M8) between pilot and owner.
- **Weather warnings** on bookings (TAF, then METAR as the flight approaches) for every airfield
  of the flight; warnings only, the pilot in command decides.
- Push notifications, maintenance reminders from flown hours, and in-app payments later.

---

## 12. Questions and answers

**I can't book: it says I don't meet the requirements.**
The form lists the reasons. Open **Account → Pilot credentials** (the link is right there): the
item may be missing, still pending, rejected or expired, or you may need a rating the owner asks
for.

**Why is my credential "Pending" again?**
You edited it after it was verified; it's checked again.

**My request disappeared from "Requested".**
The owner didn't answer within 24 hours, so it expired. You were notified, and you can request
again.

**The Check out button isn't there.**
It appears 2 hours before the booked time, only on accepted bookings, and not while the aircraft
is grounded.

**I made a mistake in the flight log after checking in.**
Ask the owner to request a correction; the log opens again for you.

**Why wasn't my booking instant?**
Instant booking needs the owner to switch it on, a completed earlier rental of that aircraft,
every requirement met and no pending checkout flight.

**My aircraft disappeared from search.**
Check its status on **Overview**: it may be paused, unlisted (e.g. the ARC or insurance expired)
or grounded.

**I didn't get an email.**
Check your spam folder. You'll always find the same information under 🔔 **Notifications**.
