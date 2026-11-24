import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { databaseIdSchema } from "../../lib/ids.js";
import { prisma } from "../../lib/prisma.js";
import { logSecurityAdminAccess, logSecurityGlobalRead } from "../../lib/security-log.js";

export const forecastsRouter = Router();
forecastsRouter.use(authenticate);
forecastsRouter.post("/alerts", authorize("ADMIN", "ANALISTA"), async (req, res, next) => {
  try {
    const input = z.object({
      previsaoId: databaseIdSchema, tipo: z.string().trim().min(1).max(30),
      mensagem: z.string().trim().min(1).max(2000),
      nivel: z.enum(["BAIXO", "MEDIO", "ALTO", "CRITICO"]),
    }).parse(req.body);
    const forecast = await prisma.previsao.findUnique({ where: { id: input.previsaoId },
      include: { talhao: { include: { propriedade: true } } } });
    if (!forecast) return res.status(404).json({ error: "Previsão não encontrada" });
    const data = await prisma.alerta.create({ data: { ...input, notificacoes: { create: {
      usuarioId: forecast.talhao.propriedade.usuarioId, titulo: input.tipo, mensagem: input.mensagem,
    } } } });
    return res.status(201).json({ data });
  } catch (error) { next(error); }
});
const talhao = { select: { id: true, nome: true, propriedade: { select: { nome: true } } } } as const;
forecastsRouter.get("/alerts", async (req, res, next) => {
  try {
    const audit = {
      control: "IDOR" as const,
      userId: req.user!.id,
      ip: req.ip ?? "desconhecido",
      resource: "alertas:*",
    };
    if (req.user!.role === "ADMIN") logSecurityAdminAccess(audit);
    if (req.user!.role === "ANALISTA") logSecurityGlobalRead(audit);
    const data = await prisma.alerta.findMany({
      where: req.user!.role === "PRODUTOR_EXPORTADOR"
        ? { previsao: { talhao: { propriedade: { usuarioId: req.user!.id } } } } : undefined,
      include: { previsao: { include: { talhao } } },
      orderBy: { criadoEm: "desc" }, take: 200,
    });
    res.json({ data });
  } catch (error) { next(error); }
});
forecastsRouter.get("/", async (req, res, next) => {
  try {
    const audit = {
      control: "IDOR" as const,
      userId: req.user!.id,
      ip: req.ip ?? "desconhecido",
      resource: "previsoes:*",
    };
    if (req.user!.role === "ADMIN") logSecurityAdminAccess(audit);
    if (req.user!.role === "ANALISTA") logSecurityGlobalRead(audit);
    const data = await prisma.previsao.findMany({
      where: req.user!.role === "PRODUTOR_EXPORTADOR"
        ? { talhao: { propriedade: { usuarioId: req.user!.id } } } : undefined,
      include: { talhao }, orderBy: { dataInicio: "asc" }, take: 500,
    });
    res.json({ data });
  } catch (error) { next(error); }
});
forecastsRouter.post("/", authorize("ADMIN", "ANALISTA"), async (req, res, next) => {
  try {
    const input = z.object({
      talhaoId: databaseIdSchema, tipo: z.enum(["COLHEITA", "EXPORTACAO"]),
      dataInicio: z.string().datetime(), dataFim: z.string().datetime(),
      confianca: z.number().min(0).max(100).optional(),
    }).refine((data) => data.dataFim >= data.dataInicio, { message: "Data final anterior à inicial" }).parse(req.body);
    if (!await prisma.talhao.findUnique({ where: { id: input.talhaoId } })) {
      return res.status(404).json({ error: "Talhão não encontrado" });
    }
    const data = await prisma.previsao.create({ data: {
      ...input, dataInicio: new Date(input.dataInicio), dataFim: new Date(input.dataFim),
    } });
    return res.status(201).json({ data });
  } catch (error) { next(error); }
});
