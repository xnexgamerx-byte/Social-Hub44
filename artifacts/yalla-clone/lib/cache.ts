import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { Platform } from "react-native";

/** Guards against walking a pathologically large tree on the JS thread. */
const MAX_ENTRIES = 20_000;

function walk(dir: Directory, budget: { left: number }): number {
  let total = 0;
  let entries: (Directory | File)[];
  try {
    entries = dir.list();
  } catch {
    // Missing or unreadable directory contributes nothing.
    return 0;
  }
  for (const entry of entries) {
    if (budget.left <= 0) break;
    budget.left -= 1;
    if (entry instanceof File) {
      total += entry.size ?? 0;
    } else {
      total += walk(entry, budget);
    }
  }
  return total;
}

/**
 * Bytes currently held in the app's cache directory — where downloaded images
 * land. Returns null when the size cannot be measured (web, or a platform
 * that denies the read), so callers can hide the number instead of showing a
 * wrong one.
 */
export async function cacheSizeBytes(): Promise<number | null> {
  if (Platform.OS === "web") return null;
  try {
    return walk(Paths.cache, { left: MAX_ENTRIES });
  } catch {
    return null;
  }
}

/**
 * Drop cached images from memory and disk. No user data is touched.
 * On web the browser owns the image cache, so there is nothing to clear.
 */
export async function clearImageCache(): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
}

/** "98.86M" — matches how storage sizes are labelled elsewhere in the app. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)}K`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)}M`;
  return `${(mb / 1024).toFixed(2)}G`;
}
