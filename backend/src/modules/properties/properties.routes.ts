import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { databaseIdSchema } from "../../lib/ids.js";
import { prisma } from "../../lib/prisma.js";

export const propertiesRouter = Router();
propertiesRouter.use(authenticate);
propertiesRouter.get("/", async (req, res, next) => {
  try {
    const data = await prisma.propriedade.findMany({
      where: req.user!.role === "PRODUTOR_EXPORTADOR" ? { usuarioId: req.user!.id } : undefined,
      include: { talhoes: true }, orderBy: { nome: "asc" },
    });
    res.json({ data });
  } catch (error) { next(error); }
});
propertiesRouter.post("/", authorize("ADMIN", "PRODUTOR_EXPORTADOR"), async (req, res, next) => {
  try {
    const input = z.object({
      nome: z.string().trim().min(1).max(100), areaTotal: z.number().positive(),
      localizacao: z.string().trim().min(1).max(200),
      unidadeArea: z.string().trim().min(1).max(20).default("ha"),
      usuarioId: databaseIdSchema.optional(),
    }).parse(req.body);
    const usuarioId = req.user!.role === "ADMIN" ? input.usuarioId ?? req.user!.id : req.user!.id;
    if (!await prisma.usuario.findUnique({ where: { id: usuarioId } })) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    const data = await prisma.propriedade.create({ data: { ...input, usuarioId } });
    return res.status(201).json({ data });
  } catch (error) { next(error); }
});
propertiesRouter.post("/:id/plots", authorize("ADMIN", "PRODUTOR_EXPORTADOR"), async (req, res, next) => {
  try {
    const id = databaseIdSchema.parse(req.params.id);
    const input = z.object({
      nome: z.string().trim().min(1).max(100), area: z.number().positive(),
      unidadeArea: z.string().trim().min(1).max(20).default("ha"),
    }).parse(req.body);
    const property = await prisma.propriedade.findFirst({ where: {
      id, ...(req.user!.role === "PRODUTOR_EXPORTADOR" && { usuarioId: req.user!.id }),
    } });
    if (!property) return res.status(404).json({ error: "Propriedade não encontrada" });
    const data = await prisma.talhao.create({ data: { ...input, propriedadeId: id } });
    return res.status(201).json({ data });
  } catch (error) { next(error); }
});
