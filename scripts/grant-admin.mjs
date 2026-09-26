#!/usr/bin/env node
/**
 * Make an existing user an admin (can verify pilot credentials), or remove the role.
 *
 *   npm run admin:grant -- someone@example.com
 *   npm run admin:grant -- someone@example.com --revoke
 *
 * Uses DATABASE_URL_MIGRATIONS or DATABASE_URL from .env.local (or the environment).
 * The user must have signed up first.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
const revoke = process.argv.includes("--revoke");
const url = process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;

if (!email) {
  console.error("Usage: npm run admin:grant -- someone@example.com [--revoke]");
  process.exit(1);
}
if (!url) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  const [user] = await sql`select id, name from users where lower(email) = lower(${email})`;
  if (!user) {
    console.error(`No user with email ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
  } else if (revoke) {
    await sql`delete from user_roles where user_id = ${user.id} and role = 'admin'`;
    console.log(`${user.name} <${email}> is no longer an admin.`);
  } else {
    await sql`insert into user_roles (user_id, role) values (${user.id}, 'admin') on conflict do nothing`;
    console.log(`${user.name} <${email}> is now an admin. Open /admin/verifications.`);
  }
} finally {
  await sql.end();
}
