type RuntimeEnvironment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "TEST_DATABASE_URL" | "DATABASE_URL" | "REPLIT_DEV_DOMAIN" | "REPLIT_DOMAINS">>;

export function assertSeedTargetIsWritable(env: RuntimeEnvironment = process.env as RuntimeEnvironment): void {
  const isProduction = env.NODE_ENV === "production";
  const isIsolatedTest = env.NODE_ENV === "test" &&
    !!env.TEST_DATABASE_URL &&
    env.DATABASE_URL === env.TEST_DATABASE_URL;

  if (!isProduction && !isIsolatedTest) {
    throw new Error("Catalog seed writes are disabled outside production.");
  }
}

export function validateProductionDestination(
  rawUrl: string,
  requestHost?: string,
  env: RuntimeEnvironment = process.env as RuntimeEnvironment,
): URL {
  let destination: URL;
  try {
    destination = new URL(rawUrl);
  } catch {
    throw new Error("Production URL must be a valid HTTP(S) URL.");
  }

  if (destination.protocol !== "http:" && destination.protocol !== "https:") {
    throw new Error("Production URL must use http or https.");
  }

  const hostname = destination.hostname.toLowerCase();
  const requestHostname = (requestHost || "").toLowerCase().split(":")[0];
  const configuredDevHosts = [
    env.REPLIT_DEV_DOMAIN,
    ...(env.REPLIT_DOMAINS || "").split(","),
  ].map((host) => host?.trim().toLowerCase().split(":")[0]).filter((host): host is string => Boolean(host));

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".replit.dev") ||
    hostname === requestHostname ||
    configuredDevHosts.includes(hostname)
  ) {
    throw new Error("Refusing to sync to a development or same-environment URL.");
  }

  return destination;
}