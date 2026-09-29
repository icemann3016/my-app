import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getRecipient } from "@/lib/email/recipient";
import { newMessageEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/site-url";

/**
 * Email participants with unread messages they haven't been emailed about since they last read
 * the conversation: one email per unread streak (trusted code: after sending a message, and the
 * daily job). Claimed in one UPDATE so parallel runs don't send twice. Returns how many were sent.
 */
export async function deliverMessageEmails(limit = 100): Promise<number> {
  const claimed = (await getDb().execute(sql`
    with due as (
      select c.id, side.person, side.is_owner
      from public.conversations c,
        lateral (values (c.owner_id, true, c.owner_read_at, c.owner_emailed_at),
                        (c.pilot_id, false, c.pilot_read_at, c.pilot_emailed_at))
          as side(person, is_owner, read_at, emailed_at)
      where side.person is not null
        -- MSG-3: people can turn message emails off.
        and coalesce((select us.email_messages from public.user_settings us
                      where us.user_id = side.person), true)
        and c.last_message_at > now() - interval '3 days'
        and exists (select 1 from public.messages m
                    where m.conversation_id = c.id and m.sender_id is distinct from side.person
                      and m.created_at > coalesce(side.read_at, '-infinity')
                      and m.created_at > coalesce(side.emailed_at, '-infinity'))
        and (side.emailed_at is null or side.emailed_at < coalesce(side.read_at, '-infinity'))
      limit ${limit}
      for update of c skip locked
    ), claimed as (
      update public.conversations c set
        owner_emailed_at = case when due.is_owner then now() else c.owner_emailed_at end,
        pilot_emailed_at = case when due.is_owner then c.pilot_emailed_at else now() end
      from due where c.id = due.id
      returning c.id, due.person, due.is_owner, c.aircraft_id,
        case when due.is_owner then c.pilot_id else c.owner_id end as sender
    )
    select claimed.id, claimed.person, a.registration, p.display_name as sender_name
    from claimed
    join public.aircraft a on a.id = claimed.aircraft_id
    left join public.profiles p on p.id = claimed.sender`)) as unknown as {
    id: string;
    person: string;
    registration: string;
    sender_name: string | null;
  }[];
  let sent = 0;
  for (const c of claimed) {
    try {
      const to = await getRecipient(c.person);
      if (!to) continue;
      const ok = await sendEmail({
        to: to.email,
        ...newMessageEmail({
          name: to.name,
          locale: to.locale,
          sender: c.sender_name ?? "",
          registration: c.registration,
          url: `${appUrl()}/messages/${c.id}`,
        }),
      });
      if (ok) sent += 1;
    } catch (e) {
      console.error("[messages] email failed", e);
    }
  }
  return sent;
}
