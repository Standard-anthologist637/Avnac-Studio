export type SnapshotHistoryState<T> = {
  snapshots: T[];
  serialized: string[];
  index: number;
};

export type SnapshotHistoryEntry<T> = {
  snapshot: T;
  index: number;
};

export function pushHistorySnapshot<T>(
  history: SnapshotHistoryState<T>,
  snapshot: T,
  serializedSnapshot: string,
  limit: number,
): SnapshotHistoryState<T> | null {
  const currentSerialized = history.serialized[history.index];
  if (history.snapshots[history.index] && currentSerialized === serializedSnapshot) {
    return null;
  }

  const snapshots = history.snapshots.slice(0, history.index + 1);
  const serialized = history.serialized.slice(0, history.index + 1);
  snapshots.push(snapshot);
  serialized.push(serializedSnapshot);

  let index = snapshots.length - 1;
  if (snapshots.length > limit) {
    snapshots.shift();
    serialized.shift();
    index -= 1;
  }

  return {
    snapshots,
    serialized,
    index,
  };
}

export function getUndoHistoryEntry<T>(
  history: SnapshotHistoryState<T>,
): SnapshotHistoryEntry<T> | null {
  if (history.index <= 0) return null;
  const index = history.index - 1;
  return {
    snapshot: history.snapshots[index]!,
    index,
  };
}

export function getRedoHistoryEntry<T>(
  history: SnapshotHistoryState<T>,
): SnapshotHistoryEntry<T> | null {
  if (history.index >= history.snapshots.length - 1) return null;
  const index = history.index + 1;
  return {
    snapshot: history.snapshots[index]!,
    index,
  };
}