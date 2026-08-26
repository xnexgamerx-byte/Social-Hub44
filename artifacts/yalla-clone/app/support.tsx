import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetSupportContactQueryOptions,
  useOpenConversation,
} from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage } from "@/lib/apiError";

interface Topic {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  answer: string;
}

/**
 * Each topic answers the question in place. Most support traffic on an app
 * like this is the same handful of questions, and an answer the user can read
 * now beats a message they wait a day for. The contact button stays available
 * underneath for everything else.
 */
const TOPICS: Topic[] = [
  {
    key: "account",
    icon: "person-circle-outline",
    label: "الحساب",
    answer:
      "تغيير كلمة المرور من: الضبط ← الحساب والأمان. إذا سجّلت عبر Google تكدر تعيّن كلمة مرور من نفس الشاشة.\n\nحذف الحساب نهائي — يمسح ملفك ومنشوراتك ورسائلك وغرفك، وما ينرجع.",
  },
  {
    key: "recharge",
    icon: "wallet-outline",
    label: "الشحن",
    answer:
      "الكوينزات تنضاف لرصيدك مباشرة بعد نجاح العملية، وتلگى كل عملية بسجل الكوينزات داخل شاشة الشحن.\n\nإذا انخصمت الفلوس وما وصل الرصيد، راسلنا وذكر وقت العملية وقيمتها.",
  },
  {
    key: "chat",
    icon: "chatbubbles-outline",
    label: "الدردشة",
    answer:
      "تتحكم بمن يراسلك من: الضبط ← إعدادات الخصوصية ← من يمكنه مراسلتي.\n\nلحظر حساب، افتح ملفه واختر حظر. الحظر يمنع الطرفين من التواصل، وتلگى المحظورين بالقائمة السوداء.",
  },
  {
    key: "vip",
    icon: "diamond-outline",
    label: "VIP/SVIP",
    answer:
      "مزايا VIP تنفعّل بعد ما توصل نقاطك للحد المطلوب لكل مستوى. تشوف المستويات ومزاياها من صفحة VIP.\n\nالاشتراك ما ينلغى يدوياً — يبقى فعّال طول ما نقاطك فوق الحد.",
  },
  {
    key: "diamonds",
    icon: "sparkles-outline",
    label: "الألماس",
    answer:
      "الألماس تكسبه لمّا يهديك أحد داخل الغرف — حصتك من قيمة الهدية تنضاف لرصيد الألماس تلقائياً.\n\nتقدر تصرفه على أغراض المتجر المسعّرة بالألماس.",
  },
  {
    key: "tasks",
    icon: "checkbox-outline",
    label: "المهام",
    answer:
      "المهام اليومية تتجدد كل ٢٤ ساعة. المكافأة تنضاف لرصيدك أول ما تضغط استلام.\n\nإذا ما وصلت المكافأة، أعد فتح صفحة المهام — الاستلام مسجّل بالخادم وما ينضاع.",
  },
  {
    key: "hosts",
    icon: "mic-outline",
    label: "المضيفون",
    answer:
      "المضيف المعتمد إله شارة بملفه ونسبة إضافية من الهدايا اللي توصله داخل الغرف.\n\nللاستفسار عن الانضمام كمضيف، راسلنا.",
  },
  {
    key: "rooms",
    icon: "home-outline",
    label: "الغرف",
    answer:
      "إذا ما تسمع صوت: تأكد إن التطبيق عنده إذن المايكروفون من إعدادات الهاتف، وإنك آخذ مقعد على المنصة. الصوت ما يشتغل داخل Expo Go — لازم النسخة المثبّتة.\n\nصاحب الغرفة يقدر يخرج أي عضو مؤقتاً.",
  },
  {
    key: "safety",
    icon: "shield-checkmark-outline",
    label: "الأمان والإبلاغ",
    answer:
      "أبلغ عن أي حساب أو محتوى مخالف من زر الإبلاغ بملف المستخدم.\n\nكل بلاغ ينراجع، والحسابات المخالفة تنحظر. الإبلاغ سرّي — الطرف الثاني ما يشوف مين بلّغ.",
  },
  {
    key: "other",
    icon: "help-circle-outline",
    label: "أسئلة أخرى",
    answer: "إذا سؤالك مو موجود بالقائمة، راسلنا مباشرة وراح نرد عليك بأسرع وقت.",
  },
];

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<Topic | null>(null);
  const [opening, setOpening] = useState(false);

  const contactQ = useQuery(getGetSupportContactQueryOptions());
  const openConversationM = useOpenConversation();

  const messageSupport = async () => {
    const contact = contactQ.data;
    if (!contact) return;
    setActive(null);
    setOpening(true);
    try {
      const conv = await openConversationM.mutateAsync({
        data: {
          otherUserId: contact.userId,
          otherName: contact.name,
          otherAvatar: contact.avatar,
        },
      });
      router.push(
        `/dm/${conv.id}?otherUserId=${encodeURIComponent(conv.otherUserId)}&otherName=${encodeURIComponent(conv.otherName || contact.name)}&otherAvatar=${encodeURIComponent(conv.otherAvatar || contact.avatar)}`,
      );
    } catch (err) {
      Alert.alert("خطأ", apiErrorMessage(err, "تعذّر فتح محادثة الدعم"));
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="مركز خدمة العملاء" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {TOPICS.map((topic) => (
            <TouchableOpacity
              key={topic.key}
              style={[styles.cell, { backgroundColor: colors.card }]}
              onPress={() => setActive(topic)}
              activeOpacity={0.7}
            >
              <View style={styles.cellHead}>
                <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
                  <Ionicons name={topic.icon} size={19} color={colors.primary} />
                </View>
                <Text
                  style={[styles.cellLabel, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {topic.label}
                </Text>
              </View>
              <Text style={[styles.cellSub, { color: colors.mutedForeground }]}>
                مشاكل {topic.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {contactQ.isError ? (
          <QueryError
            message="تعذّر الوصول لحساب الدعم."
            onRetry={() => void contactQ.refetch()}
          />
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 14,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.contactBtn,
            { backgroundColor: contactQ.data ? colors.primary : colors.muted },
          ]}
          onPress={messageSupport}
          disabled={!contactQ.data || opening}
        >
          {opening || contactQ.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={[
                styles.contactText,
                { color: contactQ.data ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              الخدمة على الإنترنت
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={active !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActive(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setActive(null)}>
          {/* Stop taps inside the sheet from dismissing it. */}
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={styles.sheetHead}>
              <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
                <Ionicons
                  name={active?.icon ?? "help-circle-outline"}
                  size={19}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                {active?.label}
              </Text>
              <TouchableOpacity onPress={() => setActive(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sheetBody, { color: colors.mutedForeground }]}>
              {active?.answer}
            </Text>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.secondary }]}
              onPress={messageSupport}
              disabled={!contactQ.data}
            >
              <Text style={[styles.sheetBtnText, { color: colors.primary }]}>
                ما حليت مشكلتي — راسل الدعم
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: {
    // Two columns with a 12px gutter.
    width: "48%",
    flexGrow: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cellHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cellLabel: { flex: 1, fontSize: 14.5, fontWeight: "600" as const, textAlign: "right" as const },
  cellSub: { fontSize: 11.5, textAlign: "right" as const },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  contactBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  contactText: { fontSize: 15, fontWeight: "700" as const },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: { borderRadius: 18, padding: 18, gap: 14 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sheetTitle: { flex: 1, fontSize: 16, fontWeight: "700" as const, textAlign: "right" as const },
  closeBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  sheetBody: { fontSize: 13.5, lineHeight: 22, textAlign: "right" as const },
  sheetBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  sheetBtnText: { fontSize: 13.5, fontWeight: "700" as const },
});
