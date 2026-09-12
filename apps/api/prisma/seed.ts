import { PrismaClient, UserRole } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@leadestate.local";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "changeme123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin ${email} already exists, skipping.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password),
      role: UserRole.SUPER_ADMIN,
      brokerId: null,
    },
  });

  console.log(`Created super admin ${email}.`);
  if (!process.env.SUPER_ADMIN_PASSWORD) {
    console.log(`(default password: ${password} — change it after first login)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
