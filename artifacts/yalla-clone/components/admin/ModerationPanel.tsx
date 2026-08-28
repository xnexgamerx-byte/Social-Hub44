import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListBansQueryKey,
  getListBansQueryOptions,
  getListReportsQueryKey,
  getGetVoiceUsageQueryOptions,
  getListReportsQueryOptions,
  useCreateBan,
  useDeleteBan,
  useReviewReport,
  type Report,
} from "@workspace/api-client-react";
import { apiErrorMessage } from "@/lib/apiError";

const BG = "#13101F";
const CARD = "#1E1830";
const PURPLE = "#7C3AED";
const GOLD = "#F5C242";
const TEXT = "#FFFFFF";
const MUTED = "#9A91B5";
const RED = "#EF4444";
const GREEN = "#22C55E";
const BORDER = "rgba(160,130,255,0.16)";

const REASON_LABEL: Record<string, string> = {
  spam: "إزعاج",
  harassment: "تحرّش",
  nudity: "محتوى إباحي",
  scam: "احتيال",
  hate: "خطاب كراهية",
  underage: "قاصر",
  other: "أخرى",
};

const TARGET_LABEL: Record<string, string> = {
  user: "مستخدم",
  post: "منشور",
  message: "رسالة",
  room: "غرفة",
};

function relative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} س`;
  return `قبل ${Math.floor(hours / 24)} يوم`;
}

/** Ban lengths a moderator reaches for, so nobody types a number under pressure. */
const BAN_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: "يوم" },
  { days: 7, label: "أسبوع" },
  { days: 30, label: "شهر" },
  { days: 0, label: "دائم" },
];

function ReportCard({ report, onDone }: { report: Report; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const reviewM = useReviewReport();

  const decide = async (status: "actioned" | "dismissed") => {
    setBusy(true);
    try {
      await reviewM.mutateAsync({ id: report.id, data: { status } });
      onDone();
    } catch (err) {
      Alert.alert("خطأ", apiErrorMessage(err, "تعذّر تحديث البلاغ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={S.card}>
      <View style={S.cardHead}>
        <View style={S.reasonPill}>
          <Text style={S.reasonText}>{REASON_LABEL[report.reason] ?? report.reason}</Text>
        </View>
        <Text style={S.targetType}>{TARGET_LABEL[report.targetType] ?? report.targetType}</Text>
        <Text style={S.time}>{relative(report.createdAt)}</Text>
      </View>

      <Text style={S.line}>
        <Text style={S.label}>المُبلِّغ: </Text>
        {report.reporterName || report.reporterId}
      </Text>
      <Text style={S.line}>
        <Text style={S.label}>المُبلَّغ عنه: </Text>
        {report.targetUserId || "—"}
      </Text>

      {report.note ? (
        <Text style={S.note} numberOfLines={4}>
          «{report.note}»
        </Text>
      ) : null}

      {/* The snapshot is what the content said when it was reported, kept so a
          moderator can judge it even after the author edits or deletes it. */}
      {report.snapshot ? (
        <View style={S.snapshot}>
          <Text style={S.snapshotLabel}>المحتوى وقت البلاغ</Text>
          <Text style={S.snapshotText} numberOfLines={6}>
            {report.snapshot}
          </Text>
        </View>
      ) : null}

      <View style={S.actions}>
        <TouchableOpacity
          style={[S.actionBtn, { backgroundColor: "rgba(34,197,94,0.15)" }]}
          onPress={() => void decide("actioned")}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={GREEN} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={15} color={GREEN} />
              <Text style={[S.actionText, { color: GREEN }]}>اتُّخذ إجراء</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.actionBtn, { backgroundColor: "rgba(255,255,255,0.07)" }]}
          onPress={() => void decide("dismissed")}
          disabled={busy}
        >
          <Ionicons name="close-circle" size={15} color={MUTED} />
          <Text style={[S.actionText, { color: MUTED }]}>رفض البلاغ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ModerationPanel() {
  const qc = useQueryClient();
  const [showHandled, setShowHandled] = useState(false);
  const [publicId, setPublicId] = useState("");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(7);
  const [banning, setBanning] = useState(false);

  const reportsQ = useQuery(getListReportsQueryOptions());
  const usageQ = useQuery(getGetVoiceUsageQueryOptions());
  const bansQ = useQuery(getListBansQueryOptions());
  const createBanM = useCreateBan();
  const deleteBanM = useDeleteBan();

  const reports = reportsQ.data ?? [];
  const open = useMemo(() => reports.filter((r) => r.status === "open"), [reports]);
  const handled = useMemo(() => reports.filter((r) => r.status !== "open"), [reports]);

  const refreshReports = () =>
    qc.invalidateQueries({ queryKey: getListReportsQueryKey() });
  const refreshBans = () => qc.invalidateQueries({ queryKey: getListBansQueryKey() });

  const ban = async () => {
    const id = publicId.trim();
    if (!id) return;
    setBanning(true);
    try {
      await createBanM.mutateAsync({
        data: { publicId: id, reason: reason.trim(), days },
      });
      setPublicId("");
      setReason("");
      refreshBans();
      Alert.alert("تم", days === 0 ? "حظر دائم" : `حظر لمدة ${days} يوم`);
    } catch (err) {
      Alert.alert("خطأ", apiErrorMessage(err, "تعذّر تنفيذ الحظر"));
    } finally {
      setBanning(false);
    }
  };

  const unban = (userId: string, name: string) => {
    Alert.alert("رفع الحظر", `رفع الحظر عن ${name || userId}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "رفع",
        onPress: async () => {
          try {
            await deleteBanM.mutateAsync({ userId });
            refreshBans();
          } catch (err) {
            Alert.alert("خطأ", apiErrorMessage(err, "تعذّر رفع الحظر"));
          }
        },
      },
    ]);
  };

  const bans = bansQ.data ?? [];
  const shown = showHandled ? handled : open;

  return (
    <ScrollView contentContainerStyle={S.wrap} showsVerticalScrollIndicator={false}>
      {/* Voice allowance — sits first because it is the only number here
          that costs money if nobody looks at it. */}
      {usageQ.data ? (
        <View style={[S.usage, usageQ.data.percent >= 80 && S.usageHot]}>
          <View style={S.usageHead}>
            <Ionicons
              name={usageQ.data.percent >= 80 ? "warning" : "mic"}
              size={16}
              color={usageQ.data.percent >= 80 ? RED : GREEN}
            />
            <Text style={S.usageTitle}>دقائق الصوت — {usageQ.data.period}</Text>
            <Text
              style={[S.usagePct, usageQ.data.percent >= 80 && { color: RED }]}
            >
              {usageQ.data.percent}%
            </Text>
          </View>
          <View style={S.usageBarTrack}>
            <View
              style={[
                S.usageBarFill,
                {
                  width: `${Math.min(100, usageQ.data.percent)}%`,
                  backgroundColor: usageQ.data.percent >= 80 ? RED : GREEN,
                },
              ]}
            />
          </View>
          <Text style={S.usageMeta}>
            {usageQ.data.minutes.toLocaleString("en-US")} من{" "}
            {usageQ.data.freeMinutes.toLocaleString("en-US")} دقيقة مجانية ·
            تُحتسب لكل مشارك، فغرفة فيها ١٠ أشخاص تستهلك ١٠ دقائق بالدقيقة
          </Text>
        </View>
      ) : null}

      {/* Reports */}
      <View style={S.sectionHead}>
        <Text style={S.sectionTitle}>البلاغات</Text>
        <View style={S.toggleRow}>
          <TouchableOpacity
            style={[S.toggle, !showHandled && S.toggleOn]}
            onPress={() => setShowHandled(false)}
          >
            <Text style={[S.toggleText, !showHandled && S.toggleTextOn]}>
              مفتوحة {open.length > 0 ? `(${open.length})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.toggle, showHandled && S.toggleOn]}
            onPress={() => setShowHandled(true)}
          >
            <Text style={[S.toggleText, showHandled && S.toggleTextOn]}>مُعالَجة</Text>
          </TouchableOpacity>
        </View>
      </View>

      {reportsQ.isLoading ? (
        <ActivityIndicator color={PURPLE} style={{ marginVertical: 24 }} />
      ) : reportsQ.isError ? (
        <TouchableOpacity style={S.retry} onPress={() => void reportsQ.refetch()}>
          <Text style={S.retryText}>تعذّر تحميل البلاغات — إعادة المحاولة</Text>
        </TouchableOpacity>
      ) : shown.length === 0 ? (
        <View style={S.empty}>
          <Ionicons
            name={showHandled ? "archive-outline" : "shield-checkmark-outline"}
            size={32}
            color={MUTED}
          />
          <Text style={S.emptyText}>
            {showHandled ? "ماكو بلاغات معالجة" : "ماكو بلاغات مفتوحة"}
          </Text>
        </View>
      ) : (
        shown.map((r) => <ReportCard key={r.id} report={r} onDone={refreshReports} />)
      )}

      {/* Ban a user */}
      <Text style={[S.sectionTitle, { marginTop: 26 }]}>حظر حساب</Text>
      <View style={S.card}>
        <Text style={S.fieldLabel}>الـID العام للحساب</Text>
        <TextInput
          value={publicId}
          onChangeText={setPublicId}
          placeholder="12345678"
          placeholderTextColor={MUTED}
          keyboardType="number-pad"
          style={S.input}
          textAlign="center"
        />
        <Text style={S.fieldLabel}>السبب (يظهر للمستخدم)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="مخالفة شروط الاستخدام"
          placeholderTextColor={MUTED}
          style={S.input}
          textAlign="right"
        />
        <Text style={S.fieldLabel}>المدة</Text>
        <View style={S.presets}>
          {BAN_PRESETS.map((p) => (
            <TouchableOpacity
              key={p.days}
              style={[S.preset, days === p.days && S.presetOn]}
              onPress={() => setDays(p.days)}
            >
              <Text style={[S.presetText, days === p.days && S.presetTextOn]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[S.banBtn, !publicId.trim() && S.banBtnOff]}
          onPress={ban}
          disabled={!publicId.trim() || banning}
        >
          {banning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={S.banBtnText}>حظر</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Active bans */}
      <Text style={[S.sectionTitle, { marginTop: 26 }]}>
        المحظورون {bans.length > 0 ? `(${bans.length})` : ""}
      </Text>
      {bansQ.isLoading ? (
        <ActivityIndicator color={PURPLE} style={{ marginVertical: 20 }} />
      ) : bans.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyText}>ماكو حسابات محظورة</Text>
        </View>
      ) : (
        bans.map((b) => (
          <View key={b.userId} style={S.banRow}>
            <View style={{ flex: 1 }}>
              <Text style={S.banName} numberOfLines={1}>
                {b.name || b.userId}
              </Text>
              <Text style={S.banMeta} numberOfLines={1}>
                {b.reason || "بدون سبب"} ·{" "}
                {b.expiresAt ? `ينتهي ${new Date(b.expiresAt).toLocaleDateString("ar")}` : "دائم"}
              </Text>
            </View>
            <TouchableOpacity style={S.unbanBtn} onPress={() => unban(b.userId, b.name)}>
              <Text style={S.unbanText}>رفع</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  usage: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 18,
    gap: 9,
  },
  usageHot: { borderColor: "rgba(239,68,68,0.5)" },
  usageHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  usageTitle: { flex: 1, color: TEXT, fontSize: 14, fontWeight: "800", textAlign: "right" },
  usagePct: { color: GREEN, fontSize: 15, fontWeight: "900" },
  usageBarTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  usageBarFill: { height: "100%", borderRadius: 4 },
  usageMeta: { color: MUTED, fontSize: 11, lineHeight: 17, textAlign: "right" },
  wrap: { padding: 16, paddingBottom: 60 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: { color: TEXT, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  toggleRow: { flexDirection: "row", gap: 6 },
  toggle: {
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  toggleOn: { backgroundColor: PURPLE },
  toggleText: { color: MUTED, fontSize: 12, fontWeight: "700" },
  toggleTextOn: { color: "#fff" },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
    gap: 7,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  reasonPill: {
    backgroundColor: "rgba(239,68,68,0.16)",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  reasonText: { color: RED, fontSize: 11.5, fontWeight: "800" },
  targetType: { color: GOLD, fontSize: 11.5, fontWeight: "700" },
  time: { color: MUTED, fontSize: 11, marginStart: "auto" },
  line: { color: TEXT, fontSize: 13, textAlign: "right" },
  label: { color: MUTED, fontSize: 12 },
  note: {
    color: TEXT,
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
    textAlign: "right",
  },
  snapshot: {
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  snapshotLabel: { color: MUTED, fontSize: 10.5, fontWeight: "700", textAlign: "right" },
  snapshotText: { color: "#D8D2E8", fontSize: 12.5, lineHeight: 19, textAlign: "right" },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionText: { fontSize: 12.5, fontWeight: "800" },

  fieldLabel: { color: MUTED, fontSize: 11.5, fontWeight: "700", textAlign: "right" },
  input: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    color: TEXT,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  presets: { flexDirection: "row", gap: 7 },
  preset: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  presetOn: { backgroundColor: PURPLE },
  presetText: { color: MUTED, fontSize: 12, fontWeight: "700" },
  presetTextOn: { color: "#fff" },
  banBtn: {
    backgroundColor: RED,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  banBtnOff: { backgroundColor: "rgba(255,255,255,0.1)" },
  banBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  banRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  banName: { color: TEXT, fontSize: 13.5, fontWeight: "700", textAlign: "right" },
  banMeta: { color: MUTED, fontSize: 11.5, textAlign: "right", marginTop: 2 },
  unbanBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  unbanText: { color: GOLD, fontSize: 12, fontWeight: "800" },

  empty: { alignItems: "center", paddingVertical: 34, gap: 10 },
  emptyText: { color: MUTED, fontSize: 13 },
  retry: { alignItems: "center", paddingVertical: 26 },
  retryText: { color: GOLD, fontSize: 13, fontWeight: "700" },
});

export { BG };
