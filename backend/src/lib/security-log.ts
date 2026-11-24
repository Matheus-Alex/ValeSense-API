function safeLogValue(value: string): string {
  return value.replace(/[\r\n]/g, "_").slice(0, 160);
}

export function logSecurityBlocked(input: {
  control: "IDOR" | "OTP";
  reason: string;
  userId: string;
  ip: string;
  resource: string;
}): void {
  console.warn(
    `[SEGURANCA] ${input.control} bloqueado: motivo=${safeLogValue(input.reason)} usuario=${safeLogValue(input.userId)} ip=${safeLogValue(input.ip)} recurso=${safeLogValue(input.resource)}`,
  );
}

export function logSecurityAdminAccess(input: {
  control: "IDOR" | "OTP";
  userId: string;
  ip: string;
  resource: string;
}): void {
  console.info(
    `[SEGURANCA] ${input.control} acesso-admin: usuario=${safeLogValue(input.userId)} ip=${safeLogValue(input.ip)} recurso=${safeLogValue(input.resource)}`,
  );
}

export function logSecurityGlobalRead(input: {
  control: "IDOR" | "OTP";
  userId: string;
  ip: string;
  resource: string;
}): void {
  console.info(
    `[SEGURANCA] ${input.control} leitura-global: usuario=${safeLogValue(input.userId)} ip=${safeLogValue(input.ip)} recurso=${safeLogValue(input.resource)}`,
  );
}
