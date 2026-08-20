export function isAuthEnabled(value: string | undefined) {
  return value === "true";
}

export const authEnabled = isAuthEnabled(import.meta.env.VITE_AUTH_ENABLED);
