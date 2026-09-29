# Accessibility (KAN-71)

Target: WCAG 2.1 AA basics on the main flows (sign-up, search, booking, flight log, reviews,
messages). Checked on 28 September 2026.

## Checked automatically (`tests/e2e/accessibility.spec.ts`, desktop and phone)

- Page language set (`<html lang>`), exactly one visible `h1` per page, skip link to the content.
- Every visible form field has a label; every image has `alt`; every button and link has a name.
- Pages: home, sign-up, log-in, search, help, dashboard, account, credentials, aircraft page,
  booking request, booking (with the review form), bookings, messages, notifications.

- **axe-core** (`@axe-core/playwright`) runs the WCAG 2.1 A/AA rules on the same pages, colour
  contrast included, in light **and dark** mode. It found low contrast in the green "success"
  text, the amber warning text and grey text on grey badges; the colour tokens were darkened
  to at least 4.5:1 (29 Sep).

## Built in

- Forms: `TextField` / `SelectField` link labels, hints and errors (`aria-describedby`,
  `aria-invalid`); form results use `role="alert"`.
- Star ratings are real radio buttons (arrow keys work, each named "4 stars").
- The availability calendar is a list of buttons with full text for screen readers (dates,
  UTC times, kinds); details open on focus as well as hover.
- Icon-only buttons (messages, notifications, menus, calendar arrows) have `aria-label`s.
- Colours come from the theme tokens (light and dark) with readable contrast; focus rings are
  visible on every control.
- "Reduce motion" in the operating system turns off transitions.
- Times are written out with "UTC" (never only by colour or icon).

## To do by hand before launch

- Screen reader pass (VoiceOver on iPhone, NVDA on Windows) through sign-up → search → request →
  flight log → review.
- Zoom to 200 % and 320 px wide on the booking and flight log pages.
- The search map: the list view is the accessible alternative; the map itself is not usable
  with a screen reader.
