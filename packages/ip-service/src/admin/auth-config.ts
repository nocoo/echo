export interface AuthConfig {
  publicOrigin: string;
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  allowedEmails: string[];
}

export type EnvSource = Record<string, string | undefined>;

export function readAuthConfig(env: EnvSource = process.env): AuthConfig {
  return {
    publicOrigin: (env.PUBLIC_ORIGIN ?? "").trim().replace(/\/+$/, ""),
    clientId: (env.GOOGLE_CLIENT_ID ?? "").trim(),
    clientSecret: (env.GOOGLE_CLIENT_SECRET ?? "").trim(),
    sessionSecret: (env.SESSION_SECRET ?? "").trim(),
    allowedEmails: (env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  };
}

export function isEmailAllowed(email: string, allowedEmails: string[]): boolean {
  if (allowedEmails.length === 0) return false;
  return allowedEmails.includes(email.trim().toLowerCase());
}
