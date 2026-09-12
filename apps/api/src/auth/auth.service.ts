import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { BrokerStatus } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { broker: true },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    // A broker-scoped user whose broker isn't ACTIVE can't sign in — keeps
    // the "manual activate/deactivate" lever meaningful end to end.
    if (user.broker && user.broker.status !== BrokerStatus.ACTIVE) {
      throw new UnauthorizedException(`Broker account is ${user.broker.status.toLowerCase()}`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { sub: user.id, role: user.role, brokerId: user.brokerId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        brokerId: user.brokerId,
      },
    };
  }
}
