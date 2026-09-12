import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { LeadSubmissionSchema } from "@leadestate/shared-types";
import { LeadsService } from "./leads.service";

// Public — this is what the widget's embed.js will call. No auth (it runs in
// a visitor's browser); scoped by micrositeId and rate-limited by the global
// ThrottlerGuard. See LeadsService for the connector/fallback delivery logic.
@Controller("public/leads")
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Post()
  async submit(@Body() body: unknown) {
    const parsed = LeadSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    }
    return this.leads.submit(parsed.data);
  }
}
