import { app } from "./app.js";
import { env } from "./config/env.js";
import { seedInitialAdmin } from "./modules/auth/user.repository.js";
import { startThingSpeakPolling } from "./modules/sensors/thingspeak.js";
import { prisma } from "./lib/prisma.js";

await seedInitialAdmin();
const stopPolling = startThingSpeakPolling();
const server = app.listen(env.PORT, () => console.log(`ValeSense API disponível em http://localhost:${env.PORT}`));
let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  stopPolling();
  server.close(() => {
    void prisma.$disconnect().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error("Falha ao encerrar a conexão com o banco:", error);
        process.exit(1);
      },
    );
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
