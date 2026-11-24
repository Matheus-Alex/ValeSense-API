import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { prisma } from "../../lib/prisma.js";
import { logSecurityAdminAccess, logSecurityGlobalRead } from "../../lib/security-log.js";

export const marketDataRouter = Router();
marketDataRouter.use(authenticate);
marketDataRouter.get("/", async (req, res, next) => {
  try {
    const audit = {
      control: "IDOR" as const,
      userId: req.user!.id,
      ip: req.ip ?? "desconhecido",
      resource: "mercado:*",
    };
    if (req.user!.role === "ADMIN") logSecurityAdminAccess(audit);
    if (req.user!.role === "ANALISTA") logSecurityGlobalRead(audit);
    const { dias } = z.object({ dias: z.coerce.number().int().min(1).max(3650).default(365) }).parse(req.query);
    const records = await prisma.dadoMercado.findMany({
      where: { dataReferencia: { gte: new Date(Date.now() - dias * 86400000) } },
      orderBy: { dataReferencia: "asc" }, take: 10000,
    });
    res.json({ data: records.map(({ dataReferencia, ...record }) => ({
      ...record, preco: Number(record.preco), data: dataReferencia.toISOString().slice(0, 10),
    })) });
  } catch (error) { next(error); }
});
marketDataRouter.post("/", authorize("ADMIN", "ANALISTA"), async (req, res, next) => {
  try {
    const input = z.object({
      produto: z.string().trim().min(1).max(100),
      dataReferencia: z.string().datetime(),
      preco: z.number().nonnegative().finite(),
      demanda: z.string().trim().max(30).optional(),
      unidadePreco: z.string().trim().max(30).optional(),
    }).parse(req.body);
    const data = await prisma.dadoMercado.create({ data: { ...input, dataReferencia: new Date(input.dataReferencia) } });
    res.status(201).json({ data });
  } catch (error) { next(error); }
});
