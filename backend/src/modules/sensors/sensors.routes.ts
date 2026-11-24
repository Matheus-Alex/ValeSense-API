import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { databaseIdSchema } from "../../lib/ids.js";
import { prisma } from "../../lib/prisma.js";
import { recordAccess } from "../access-log/access-log.js";
import { assertCanAccessResource } from "../../lib/ownership-prisma.js";
import { ResourceNotFoundError, hasGlobalRead } from "../../lib/ownership.js";
import { logSecurityAdminAccess, logSecurityBlocked, logSecurityGlobalRead } from "../../lib/security-log.js";
import type { Request } from "express";

const sensorStatusSchema = z.object({
  status: z.enum(["ATIVO", "INATIVO", "MANUTENCAO"]),
});
const commandSchema = z.object({ comando: z.enum(["LIGAR", "DESLIGAR"]) });

async function updateOwnedSensor(request: Request, id: string, status: z.infer<typeof sensorStatusSchema>["status"]) {
  const user = request.user!;
  const ip = request.ip ?? "desconhecido";
  await assertCanAccessResource(user, "sensor", id, ip);
  const result = await prisma.sensor.updateMany({
    where: { id, ...(user.role !== "ADMIN" && { talhao: { propriedade: { usuarioId: user.id } } }) },
    data: { status },
  });
  if (!result.count) {
    logSecurityBlocked({ control: "IDOR", reason: "recurso_indisponivel", userId: user.id, ip, resource: `sensor:${id}` });
    throw new ResourceNotFoundError();
  }
  await recordAccess(request, user.id, "SENSOR", "SUCESSO");
  return prisma.sensor.findUnique({ where: { id } });
}

const createSensorSchema = z.object({
  talhaoId: databaseIdSchema,
  identificador: z.string().trim().min(1).max(50),
  canalThingSpeak: z.string().trim().max(50).optional(),
});

export const sensorsRouter = Router();
sensorsRouter.use(authenticate);

sensorsRouter.get("/plots", async (request, response, next) => {
  try {
    const audit = {
      control: "IDOR" as const,
      userId: request.user!.id,
      ip: request.ip ?? "desconhecido",
      resource: "talhoes:*",
    };
    if (request.user!.role === "ADMIN") logSecurityAdminAccess(audit);
    if (request.user!.role === "ANALISTA") logSecurityGlobalRead(audit);
    const plots = await prisma.talhao.findMany({
      where: !hasGlobalRead(request.user!.role)
        ? { propriedade: { usuarioId: request.user!.id } }
        : undefined,
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        area: true,
        unidadeArea: true,
        propriedade: { select: { nome: true } },
      },
    });
    return response.status(200).json({ data: plots });
  } catch (error) {
    next(error);
  }
});

sensorsRouter.get("/", async (request, response, next) => {
  try {
    const audit = {
      control: "IDOR" as const,
      userId: request.user!.id,
      ip: request.ip ?? "desconhecido",
      resource: "sensores:*",
    };
    if (request.user!.role === "ADMIN") logSecurityAdminAccess(audit);
    if (request.user!.role === "ANALISTA") logSecurityGlobalRead(audit);
    const sensors = await prisma.sensor.findMany({
      where: !hasGlobalRead(request.user!.role)
        ? { talhao: { propriedade: { usuarioId: request.user!.id } } }
        : undefined,
      orderBy: { identificador: "asc" },
      include: {
        talhao: {
          select: {
            id: true,
            nome: true,
            propriedade: { select: { nome: true } },
          },
        },
        leituras: { orderBy: { dataHora: "desc" }, take: 1 },
      },
    });
    return response.status(200).json({
      data: sensors.map((sensor) => ({
        id: sensor.id,
        identificador: sensor.identificador,
        status: sensor.status,
        canalThingSpeak: sensor.canalThingSpeak,
        talhao: sensor.talhao,
        ultimaLeitura: sensor.leituras[0]
          ? {
              temperatura: Number(sensor.leituras[0].temperatura),
              umidade: Number(sensor.leituras[0].umidade),
              timestamp: sensor.leituras[0].dataHora.toISOString(),
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

sensorsRouter.post("/", authorize("ADMIN", "PRODUTOR_EXPORTADOR"), async (request, response, next) => {
  try {
    const input = createSensorSchema.parse(request.body);
    await assertCanAccessResource(request.user!, "talhao", input.talhaoId, request.ip ?? "desconhecido");
    const sensor = await prisma.sensor.create({
      data: {
        talhaoId: input.talhaoId,
        identificador: input.identificador,
        canalThingSpeak: input.canalThingSpeak || null,
      },
    });
    await recordAccess(request, request.user!.id, "SENSOR", "SUCESSO");
    return response.status(201).json({ sensor });
  } catch (error) {
    next(error);
  }
});

sensorsRouter.patch("/:id/status", async (request, response, next) => {
  try {
    const id = databaseIdSchema.parse(request.params.id);
    const { status } = sensorStatusSchema.parse(request.body);
    const sensor = await updateOwnedSensor(request, id, status);
    return response.status(200).json({ sensor });
  } catch (error) {
    next(error);
  }
});

sensorsRouter.post("/:id/comandos", async (request, response, next) => {
  try {
    const id = databaseIdSchema.parse(request.params.id);
    const { comando } = commandSchema.parse(request.body);
    const sensor = await updateOwnedSensor(request, id, comando === "LIGAR" ? "ATIVO" : "INATIVO");
    return response.status(200).json({ message: "Estado do sensor atualizado no ValeSense", sensor });
  } catch (error) {
    next(error);
  }
});
