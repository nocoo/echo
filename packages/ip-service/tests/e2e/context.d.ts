import "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    dashboardDir: string;
  }
}
