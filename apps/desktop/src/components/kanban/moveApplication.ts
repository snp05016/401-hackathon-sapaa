import type { Application, ApplicationStage } from "@ghostboard/shared";

/** TODO(team)[tracking]: call IPC to update DB, insert stage_changed event, handle optimistic-UI rollback on failure. */
export async function moveApplication(
  applicationId: string,
  fromStage: ApplicationStage,
  toStage: ApplicationStage,
): Promise<Application> {
  void applicationId;
  void fromStage;
  void toStage;
  throw new Error("TODO(team): implement moveApplication persistence");
}
