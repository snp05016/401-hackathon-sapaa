import type { Application, ApplicationStatusProvider, ApplicationStatusUpdate } from "@ghostboard/shared";

export const emailStatusProvider: ApplicationStatusProvider = {
  name: "gmail",
  /** TODO(team)[tracking]: integrate Gmail API, classify rejection/interview emails. */
  async checkForUpdates(applications: Application[]): Promise<ApplicationStatusUpdate[]> {
    void applications;
    return [];
  },
};
