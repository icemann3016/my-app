# Flying: check-out, flight log and check-in

Every rental has a **flight log**: a record between you and the owner. It is **not** the
aircraft's journey or technical log, and not your pilot logbook.

## Check-out

From **2 hours before** the booked time, your booking has a **Check out** button. It opens the
flight log and puts the booking **In progress**. Enter what you find before the first flight:
Hobbs and tach, fuel on board, oil level, and optionally a photo of the meters.

## Legs

Add one **leg** per flight (**Add leg**), for example LBSF → LBPD → LBSF as two legs:

- **From / To** airfields and the **date**.
- **Block off, engine start, take-off, landing, engine stop, block on**, all in UTC. Take-off
  and landing are optional. Times past midnight (UTC) are handled.
- **Landings**, **Hobbs** and **tach** at start and end, **fuel** and **oil** before and after.

The app refuses times out of order, legs longer than 24 hours and meters that go backwards. You
can edit or delete legs until you check in.

## Fuel and oil added

**Add fuel or oil** for every refuelling or oil top-up: airfield, quantity, fuel type or oil
grade, **price paid** (in the booking's currency), **who paid** (you, or the owner's account) and
the **receipt** (optional; the owner can open it). How it counts in the amount due:

- **Wet rate:** fuel you paid for is taken off.
- **Dry rate:** fuel from the owner's account is added.
- **Oil** is part of both rates, so oil you paid for is always taken off.
- Entries without a price don't count, and the page says so.

## Remarks and PIREPs

Under **Remarks and PIREPs**, note anything the owner or the next pilot should know that isn't a
defect: about the **aircraft** ("COM2 scratchy"), the **weather** or an **airfield**.

## Report a defect

Something that may affect airworthiness? Use **Report a defect** (on the booking or the flight
log): how serious it is (**minor**, **major**, or **unsafe**: shouldn't fly), what's wrong, and
an optional photo. The owner is emailed straight away.

## Check-in

When you're back, **Check in and send to the owner**. The summary shows the **flown time** (on
the aircraft's time basis: Hobbs, tach or block time), the **billed hours** (at least the owner's
minimum per day) × rate, the **fuel and oil** adjustment and the **amount due**. After check-in
you can't change the log, unless the owner asks for a **correction**: then it opens again with
their note, and you send it once more.

When the owner **confirms**, the booking is **Completed**. Pay the owner directly.

## Export your flights

**Bookings → Export my flights (CSV)** downloads all legs from your sent and confirmed flight
logs in logbook order (date, departure and off-block time, arrival and on-block time in UTC,
type, registration, block time, landings), to help you fill in your pilot logbook.
