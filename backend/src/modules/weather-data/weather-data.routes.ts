import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { databaseIdSchema } from "../../lib/ids.js";
import { prisma } from "../../lib/prisma.js";
import { assertCanAccessResource, assertCanReadResource } from "../../lib/ownership-prisma.js";
import { hasGlobalRead } from "../../lib/ownership.js";
import { logSecurityAdminAccess, logSecurityGlobalRead } from "../../lib/security-log.js";

export const weatherDataRouter = Router();
weatherDataRouter.use(authenticate);
weatherDataRouter.get("/", async (req, res, next) => {
  try {
    const query = z.object({
      dias: z.coerce.number().int().min(1).max(365).default(7),
      horas: z.coerce.number().int().min(1).max(8760).optional(),
      sensorId: databaseIdSchema.optional(),
    }).parse(req.query);
    if (query.sensorId) {
      await assertCanReadResource(req.user!, "sensor", query.sensorId, req.ip ?? "desconhecido");
    } else {
      const audit = {
        control: "IDOR" as const,
        userId: req.user!.id,
        ip: req.ip ?? "desconhecido",
        resource: "leituras:*",
      };
      if (req.user!.role === "ADMIN") logSecurityAdminAccess(audit);
      if (req.user!.role === "ANALISTA") logSecurityGlobalRead(audit);
    }
    const readings = await prisma.leituraClimatica.findMany({
      where: {
        dataHora: { gte: new Date(Date.now() - (query.horas ?? query.dias * 24) * 3600000) },
        ...(query.sensorId && { sensorId: query.sensorId }),
        ...(!hasGlobalRead(req.user!.role) && {
          sensor: { talhao: { propriedade: { usuarioId: req.user!.id } } },
        }),
      },
      include: { sensor: { select: { id: true, identificador: true, status: true, talhao: { select: { id: true, nome: true } } } } },
      orderBy: { dataHora: "desc" }, take: 10000,
    });
    res.json({ data: readings.reverse().map(({ dataHora, ...reading }) => ({
      ...reading, temperatura: Number(reading.temperatura), umidade: Number(reading.umidade),
      timestamp: dataHora.toISOString(),
    })) });
  } catch (error) { next(error); }
});
weatherDataRouter.post("/", authorize("ADMIN"), async (req, res, next) => {
  try {
    const input = z.object({
      sensorId: databaseIdSchema, temperatura: z.number().finite(),
      umidade: z.number().min(0).max(100),
      timestamp: z.string().datetime().optional(),
    }).parse(req.body);
    await assertCanAccessResource(req.user!, "sensor", input.sensorId, req.ip ?? "desconhecido");
    const data = await prisma.leituraClimatica.create({ data: {
      sensorId: input.sensorId, temperatura: input.temperatura, umidade: input.umidade,
      dataHora: input.timestamp ? new Date(input.timestamp) : new Date(),
    } });
    return res.status(201).json({ data });
  } catch (error) { next(error); }
});
