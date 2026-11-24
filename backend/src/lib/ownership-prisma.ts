import { prisma } from "./prisma.js";
import { createOwnershipChecker } from "./ownership.js";
import { logSecurityAdminAccess, logSecurityBlocked, logSecurityGlobalRead } from "./security-log.js";

const ownershipChecker = createOwnershipChecker({
  async findOwnerId(resource, resourceId) {
    if (resource === "sensor") {
      const sensor = await prisma.sensor.findUnique({
        where: { id: resourceId },
        select: { talhao: { select: { propriedade: { select: { usuarioId: true } } } } },
      });
      return sensor?.talhao.propriedade.usuarioId ?? null;
    }

    const plot = await prisma.talhao.findUnique({
      where: { id: resourceId },
      select: { propriedade: { select: { usuarioId: true } } },
    });
    return plot?.propriedade.usuarioId ?? null;
  },
}, {
  blocked: logSecurityBlocked,
  adminAccess: logSecurityAdminAccess,
  globalRead: logSecurityGlobalRead,
});

export function assertCanAccessResource(
  user: { id: string; role: "ADMIN" | "ANALISTA" | "PRODUTOR_EXPORTADOR" },
  resource: "sensor" | "talhao",
  resourceId: string,
  ip: string,
): Promise<void> {
  return ownershipChecker(user, resource, resourceId, ip);
}

/** Leitura: ADMIN e ANALISTA acessam qualquer recurso existente; os demais, só os próprios. */
export function assertCanReadResource(
  user: { id: string; role: "ADMIN" | "ANALISTA" | "PRODUTOR_EXPORTADOR" },
  resource: "sensor" | "talhao",
  resourceId: string,
  ip: string,
): Promise<void> {
  return ownershipChecker(user, resource, resourceId, ip, "read");
}
