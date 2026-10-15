/**
 * Seeds (or promotes) one identity to SUPER_ADMIN, for local testing of the
 * admin console without a real SMS gateway or a chicken-and-egg "who grants
 * the first admin role" problem — `PATCH /admin/users/:id/roles` itself
 * requires SUPER_ADMIN to call.
 *
 * Configured entirely from env (see .env / .env.example):
 *   ADMIN_MOBILE          - required; the account to promote. Unset = skip.
 *   DEFAULT_PHONE_REGION  - parsing region for ADMIN_MOBILE, default "IN".
 *
 * Sign-in itself still goes through the normal OTP flow — this script only
 * grants the role. Pair it with OTP_DEV_FIXED_CODE (already in .env) to sign
 * in without a real SMS: request an OTP for ADMIN_MOBILE, enter that fixed
 * code, done.
 *
 * Run with: npm run db:seed  (invokes this per tools/scripts/prisma.mjs)
 */
import { PrismaClient } from '@ecom-db/auth';
import { normaliseMobile } from '@ecommerce/common';
import { KafkaTopics, Role } from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';

async function main() {
  const rawMobile = process.env.ADMIN_MOBILE?.trim();

  if (!rawMobile) {
    console.log('[seed:auth] ADMIN_MOBILE is not set - skipping admin seed.');
    return;
  }

  const region = process.env.DEFAULT_PHONE_REGION ?? 'IN';
  const { e164, mobile, countryCode } = normaliseMobile(rawMobile, region);

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.identity.findUnique({ where: { e164 } });
    const roles = Array.from(new Set([...(existing?.roles ?? []), Role.SUPER_ADMIN]));

    const identity = await prisma.$transaction(async (tx) => {
      const row = await tx.identity.upsert({
        where: { e164 },
        create: {
          mobile,
          countryCode,
          e164,
          mobileVerifiedAt: new Date(),
          roles,
        },
        update: {
          roles,
        },
      });

      // A real OTP registration publishes USER_REGISTERED so user-service creates the
      // matching UserProfile row; this upsert skips that entirely, which left the seeded
      // admin without a profile and broke anything that needs one (e.g. applying as a
      // vendor). Only needed the first time - an existing identity already has one.
      if (!existing) {
        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.USER_REGISTERED,
            partitionKey: row.id,
            actorId: row.id,
            source: 'SEED',
            payload: {
              userId: row.id,
              mobile: row.mobile,
              countryCode: row.countryCode,
              email: row.email ?? undefined,
              roles: row.roles,
              referralCode: row.referralCode ?? undefined,
              registeredAt: row.createdAt.toISOString(),
            },
          }),
        });
      }

      return row;
    });

    console.log(
      `[seed:auth] ${existing ? 'promoted' : 'created'} ${e164} -> roles: ${identity.roles.join(', ')} (id ${identity.id})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[seed:auth] failed:', error);
  process.exitCode = 1;
});
