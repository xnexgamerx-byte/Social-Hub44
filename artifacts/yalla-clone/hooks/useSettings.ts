import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetMySettingsQueryKey,
  getGetMySettingsQueryOptions,
  useUpdateMySettings,
  type UserSettings,
  type UserSettingsPatch,
} from "@workspace/api-client-react";
import { apiErrorMessage } from "@/lib/apiError";

export type UpdateResult = { ok: true } | { ok: false; error: string };

/**
 * Read the current user's settings and patch them one field at a time.
 *
 * Writes are optimistic: a switch has to move the instant it is tapped, and
 * the previous value is restored if the server rejects it. Only the changed
 * key is sent — the endpoint leaves omitted fields alone.
 */
export function useSettings() {
  const qc = useQueryClient();
  const query = useQuery(getGetMySettingsQueryOptions());
  const mutation = useUpdateMySettings();

  async function update(patch: UserSettingsPatch): Promise<UpdateResult> {
    const key = getGetMySettingsQueryKey();
    const previous = qc.getQueryData<UserSettings>(key);
    if (previous) qc.setQueryData(key, { ...previous, ...patch });
    try {
      const next = await mutation.mutateAsync({ data: patch });
      qc.setQueryData(key, next);
      return { ok: true };
    } catch (err) {
      if (previous) qc.setQueryData(key, previous);
      return { ok: false, error: apiErrorMessage(err, "تعذّر حفظ الإعداد") };
    }
  }

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    update,
    saving: mutation.isPending,
  };
}
