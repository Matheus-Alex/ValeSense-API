import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

export function parseFeed(feed: { field1?: unknown; field2?: unknown; created_at?: unknown }) {
  if (typeof feed.field1 !== "string" || !feed.field1.trim() ||
      typeof feed.field2 !== "string" || !feed.field2.trim() ||
      typeof feed.created_at !== "string") return null;
  const temperatura = Number(feed.field1), umidade = Number(feed.field2);
  const dataHora = new Date(feed.created_at);
  if (!Number.isFinite(temperatura) || !Number.isFinite(umidade) || umidade < 0 || umidade > 100 ||
      Number.isNaN(dataHora.getTime())) return null;
  return { temperatura, umidade, dataHora };
}

export function startThingSpeakPolling() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function poll() {
    try {
      const sensors = await prisma.sensor.findMany({ where: { status: "ATIVO", canalThingSpeak: { not: null } } });
      for (const sensor of sensors) {
        if (!sensor.canalThingSpeak || !/^\d+$/.test(sensor.canalThingSpeak)) continue;
        try {
          const response = await fetch("https://api.thingspeak.com/channels/" + sensor.canalThingSpeak + "/feeds.json?results=100", { signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error("ThingSpeak respondeu HTTP " + response.status);
          const body = await response.json() as { feeds?: { field1?: unknown; field2?: unknown; created_at?: unknown }[] };
          if (!Array.isArray(body.feeds)) throw new Error("Resposta inválida do ThingSpeak");
          for (const feed of body.feeds) {
            const reading = parseFeed(feed);
            if (!reading) continue;
            const existing = await prisma.leituraClimatica.findFirst({
              where: { sensorId: sensor.id, dataHora: reading.dataHora }, select: { id: true },
            });
            if (!existing) await prisma.leituraClimatica.create({ data: { sensorId: sensor.id, ...reading } });
          }
        } catch (error) {
          console.error("Falha ao sincronizar sensor " + sensor.identificador + ":", error instanceof Error ? error.message : "Erro desconhecido");
        }
      }
    } catch (error) {
      console.error("Falha na consulta dos sensores para sincronização:", error);
    } finally {
      if (!stopped) { timer = setTimeout(poll, env.THINGSPEAK_POLL_SECONDS * 1000); timer.unref(); }
    }
  }
  void poll();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

