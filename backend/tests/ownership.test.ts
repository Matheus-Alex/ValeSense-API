import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { databaseIdSchema } from "../src/lib/ids.js";
import {
  createOwnershipChecker,
  hasGlobalRead,
  ResourceNotFoundError,
  type OwnedResource,
  type OwnershipLogger,
} from "../src/lib/ownership.js";

const sensorId = "64a1b2c3-d4e5-4789-a012-345678901234";
const plotId = "64a1b2c3-d4e5-4789-a012-345678901235";
const ownerId = "64a1b2c3-d4e5-4789-a012-345678901240";
const strangerId = "64a1b2c3-d4e5-4789-a012-345678901241";
const adminId = "64a1b2c3-d4e5-4789-a012-345678901242";
const analystId = "64a1b2c3-d4e5-4789-a012-345678901243";

type Entry = Record<string, string>;

function createTestOwnershipChecker() {
  const owners = new Map<string, string>([
    [`sensor:${sensorId}`, ownerId],
    [`talhao:${plotId}`, ownerId],
  ]);
  const blocked: Entry[] = [];
  const adminAccess: Entry[] = [];
  const globalRead: Entry[] = [];
  const logger: OwnershipLogger = {
    blocked: (entry) => blocked.push(entry),
    adminAccess: (entry) => adminAccess.push(entry),
    globalRead: (entry) => globalRead.push(entry),
  };
  const checker = createOwnershipChecker({
    async findOwnerId(resource: OwnedResource, resourceId: string) {
      return owners.get(`${resource}:${resourceId}`) ?? null;
    },
  }, logger);
  return { checker, blocked, adminAccess, globalRead };
}

async function assertNotFound(promise: Promise<void>) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ResourceNotFoundError);
    assert.equal(error.statusCode, 404);
    return true;
  });
}

describe("verificação de propriedade", () => {
  it("permite ao dono acessar sensor e talhão próprios", async () => {
    const { checker } = createTestOwnershipChecker();
    const user = { id: ownerId, role: "PRODUTOR_EXPORTADOR" as const };
    await checker(user, "sensor", sensorId, "127.0.0.1");
    await checker(user, "talhao", plotId, "127.0.0.1");
  });

  it("retorna o mesmo 404 para recurso de terceiro e recurso inexistente", async () => {
    const { checker, blocked } = createTestOwnershipChecker();
    const attacker = { id: strangerId, role: "PRODUTOR_EXPORTADOR" as const };
    const results: Array<{ statusCode: number; message: string }> = [];
    for (const id of [sensorId, "64a1b2c3-d4e5-4789-a012-345678901236"]) {
      try {
        await checker(attacker, "sensor", id, "127.0.0.2");
        assert.fail("O recurso deveria ser negado");
      } catch (error) {
        assert.ok(error instanceof ResourceNotFoundError);
        results.push({ statusCode: error.statusCode, message: error.message });
      }
    }
    assert.deepEqual(results[0], results[1]);
    assert.equal(blocked.length, 2);
  });

  it("permite acesso administrativo e registra o acesso", async () => {
    const { checker, adminAccess } = createTestOwnershipChecker();
    await checker({ id: adminId, role: "ADMIN" }, "sensor", sensorId, "127.0.0.3");
    assert.equal(adminAccess.length, 1);
    assert.equal(adminAccess[0].resource, `sensor:${sensorId}`);
  });
});

describe("leitura global do analista", () => {
  it("hasGlobalRead vale só para ADMIN e ANALISTA", () => {
    assert.equal(hasGlobalRead("ADMIN"), true);
    assert.equal(hasGlobalRead("ANALISTA"), true);
    assert.equal(hasGlobalRead("PRODUTOR_EXPORTADOR"), false);
  });

  it("analista LÊ sensor e talhão de outro usuário e a leitura é registrada", async () => {
    const { checker, blocked, globalRead } = createTestOwnershipChecker();
    const analyst = { id: analystId, role: "ANALISTA" as const };
    await checker(analyst, "sensor", sensorId, "127.0.0.4", "read");
    await checker(analyst, "talhao", plotId, "127.0.0.4", "read");
    assert.equal(blocked.length, 0);
    assert.equal(globalRead.length, 2);
    assert.equal(globalRead[0].resource, `sensor:${sensorId}`);
  });

  it("analista NÃO altera recurso de outro usuário (modo escrita é o padrão)", async () => {
    const { checker, blocked, globalRead } = createTestOwnershipChecker();
    const analyst = { id: analystId, role: "ANALISTA" as const };
    await assertNotFound(checker(analyst, "sensor", sensorId, "127.0.0.5"));
    await assertNotFound(checker(analyst, "sensor", sensorId, "127.0.0.5", "write"));
    assert.equal(blocked.length, 2);
    assert.equal(globalRead.length, 0);
  });

  it("analista continua recebendo 404 para recurso inexistente, mesmo lendo", async () => {
    const { checker } = createTestOwnershipChecker();
    const analyst = { id: analystId, role: "ANALISTA" as const };
    await assertNotFound(checker(analyst, "sensor", "64a1b2c3-d4e5-4789-a012-345678901299", "127.0.0.6", "read"));
  });

  it("produtor NÃO ganha leitura global: modo leitura também bloqueia terceiros", async () => {
    const { checker, globalRead } = createTestOwnershipChecker();
    const producer = { id: strangerId, role: "PRODUTOR_EXPORTADOR" as const };
    await assertNotFound(checker(producer, "sensor", sensorId, "127.0.0.7", "read"));
    assert.equal(globalRead.length, 0);
  });
});

describe("identificadores", () => {
  it("aceita UUID v4 e rejeita IDs antigos ou malformados", () => {
    assert.equal(databaseIdSchema.safeParse(sensorId).success, true);
    assert.equal(databaseIdSchema.safeParse("64a1b2c3d4e5f67890123456").success, false);
    assert.equal(databaseIdSchema.safeParse("64a1b2c3-d4e5-f678-9012-345678901234").success, false);
    assert.equal(databaseIdSchema.safeParse("not-an-id").success, false);
  });
});
