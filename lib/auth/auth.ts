import "server-only";

import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDb, schema } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail, verifyEmailEmail } from "@/lib/email/templates";
import { siteConfig } from "@/lib/site";
import { getStorage } from "@/lib/storage";
import { isGoogleEnabled } from "./google";

/**
 * Public URL of the site, used in links inside emails. Set BETTER_AUTH_URL everywhere you deploy;
 * without it we fall back to Vercel's address or, in development, http://localhost:3000.
 */
function siteUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  const vercelUrl =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  if (process.env.NODE_ENV === "production") {
    console.warn("[auth] BETTER_AUTH_URL is not set: links in emails may be wrong.");
  }
  return "http://localhost:3000";
}

/** The user's chosen language, for emails. */
async function userLocale(userId: string): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ locale: schema.userSettings.locale })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  return row?.locale;
}

function createAuth() {
  return betterAuth({
    appName: siteConfig.name,
    baseURL: siteUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        rateLimit: schema.rateLimits,
      },
    }),
    advanced: {
      cookiePrefix: "app",
      database: { generateId: "uuid" },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 72,
      // Switch on once a real email service is configured (EMAIL_DRIVER=smtp).
      requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const locale = await userLocale(user.id);
        await sendEmail({
          to: user.email,
          ...resetPasswordEmail({ name: user.name, url, locale }),
        });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const locale = await userLocale(user.id);
        await sendEmail({ to: user.email, ...verifyEmailEmail({ name: user.name, url, locale }) });
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        // Profile, settings, roles and sessions are removed by the database (ON DELETE CASCADE);
        // files in storage have to be removed here.
        beforeDelete: async (user) => {
          const [profile] = await getDb()
            .select({ avatarKey: schema.profiles.avatarKey })
            .from(schema.profiles)
            .where(eq(schema.profiles.id, user.id));
          if (profile?.avatarKey) {
            await getStorage()
              .delete(profile.avatarKey)
              .catch((e) => console.warn("[auth] couldn't delete avatar", e));
          }
        },
      },
    },
    socialProviders: isGoogleEnabled()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    rateLimit: {
      // Stored in Postgres so limits hold across several server instances.
      storage: "database",
    },
    plugins: [nextCookies()], // keep last: lets Server Actions set the session cookie
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { auth?: Auth };

/** The Better Auth instance (created on first use, so builds work without a database). */
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
