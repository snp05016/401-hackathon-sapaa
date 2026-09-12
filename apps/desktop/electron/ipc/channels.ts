export const IPC_CHANNELS = {
  listApplications: "applications:list",
  updateDeadline: "applications:update-deadline",
  moveApplication: "applications:move",
  evaluateFollowUps: "applications:evaluate-follow-ups",
  dismissFollowUp: "applications:dismiss-follow-up",
  getProfile: "profile:get",
  saveProfile: "profile:save",
  bridgeInfo: "bridge:info",
} as const;
