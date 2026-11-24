import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ResourceNotFoundError } from "../lib/ownership.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ResourceNotFoundError) {
    return response.status(404).json({ error: error.message });
  }
  if (error instanceof ZodError) {
    return response.status(400).json({ error: "Dados de entrada inválidos", details: error.flatten() });
  }
  if (error?.code === "P2002") {
    return response.status(409).json({ error: "Já existe um registro com estes dados." });
  }
  if (error?.code === "P2025") {
    return response.status(404).json({ error: "Registro não encontrado." });
  }
  console.error(error);
  return response.status(500).json({ error: "Erro interno do servidor" });
};
