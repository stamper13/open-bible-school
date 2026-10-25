export const NT_PILOT_ALLOWED_EMAIL = "adstamper35@gmail.com";

export function isNtPilotEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === NT_PILOT_ALLOWED_EMAIL;
}
