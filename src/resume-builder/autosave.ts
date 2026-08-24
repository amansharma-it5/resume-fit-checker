export function saveSnapshotIsCurrent(currentResume: unknown, savedSnapshotJson: string) {
  return JSON.stringify(currentResume) === savedSnapshotJson;
}
