import type { Application, ApplicationStage } from "@ghostboard/shared";
import { ipc } from "../../lib/ipc";

export async function moveApplication(
  applicationId: string,
  fromStage: ApplicationStage,
  toStage: ApplicationStage,
): Promise<Application> {
  const { application } = await ipc().moveApplication({ applicationId, fromStage, toStage });
  return application;
}
