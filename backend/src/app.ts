import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { forecastsRouter } from "./modules/forecasts/forecasts.routes.js";
import { marketDataRouter } from "./modules/market-data/market-data.routes.js";
import { sensorsRouter } from "./modules/sensors/sensors.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { weatherDataRouter } from "./modules/weather-data/weather-data.routes.js";
import { prisma } from "./lib/prisma.js";
import { propertiesRouter } from "./modules/properties/properties.routes.js";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY);
const allowedOrigins = new Set(env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(express.json());

app.get("/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return response.status(200).json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Banco de dados indisponível durante a verificação de saúde:", error);
    return response.status(503).json({ status: "error", database: "unavailable" });
  }
});
app.get("/api/public-config", (_request, response) => {
  response.set("Cache-Control", "no-store");
  return response.json({ thingspeakChannelId: env.THINGSPEAK_CHANNEL_ID ?? null });
});
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/forecasts", forecastsRouter);
app.use("/api/market-data", marketDataRouter);
app.use("/api/sensors", sensorsRouter);
app.use("/api/weather-data", weatherDataRouter);
app.use("/api/properties", propertiesRouter);
app.use("/api", (_request, response) => {
  return response.status(404).json({ error: "Rota não encontrada" });
});
app.use(errorHandler);
