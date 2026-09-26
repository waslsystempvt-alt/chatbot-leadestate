import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import express, { type Request, type Response } from "express";

// ---------------------------------------------------------------------------
// Shared serverless bootstrap (Vercel)
// ---------------------------------------------------------------------------
const expressServer = express();
let cachedApp: express.Express | null = null;

async function getApp(): Promise<express.Express> {
  if (!cachedApp) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressServer),
      { logger: ["error", "warn", "log"] },
    );
    app.enableCors({ origin: true, credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    cachedApp = expressServer;
  }
  return cachedApp;
}

// ---------------------------------------------------------------------------
// Vercel serverless handler (default export)
// ---------------------------------------------------------------------------
export default async (req: Request, res: Response): Promise<void> => {
  const app = await getApp();
  app(req, res);
};

// ---------------------------------------------------------------------------
// Local dev: start a normal HTTP server when run directly
// ---------------------------------------------------------------------------
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${port}`);
}

// Only start the server when running locally (not on Vercel)
if (process.env.VERCEL !== "1") {
  bootstrap();
}
