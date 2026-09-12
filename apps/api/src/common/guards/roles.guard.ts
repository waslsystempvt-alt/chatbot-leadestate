import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthUser } from "../decorators/current-user.decorator";

/**
 * Runs after JwtAuthGuard. Requires req.user.role to be one of @Roles(...).
 * No @Roles() on a route = any authenticated user may call it.
 *
 * This is the role check. Tenant isolation (a BROKER_ADMIN/AGENT can only
 * ever touch rows where brokerId === req.user.brokerId) is enforced one
 * layer down, in each service method, by always scoping Prisma queries with
 * the brokerId taken from the JWT — never from client input.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    return !!user && required.includes(user.role);
  }
}
