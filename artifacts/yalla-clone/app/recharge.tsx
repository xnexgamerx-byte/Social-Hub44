import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  getListCoinPackagesQueryOptions,
  getListWalletTransactionsQueryOptions,
  type CoinPackage,
  type WalletTransaction,
} from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import {
  MissingTransactionIdError,
  PurchaseCancelledError,
  useRevenueCat,
} from "@/lib/revenuecat";

type RechargeTab = "packages" | "history";

const TX_LABEL: Record<string, string> = {
  recharge: "شحن كوينزات",
  purchase: "شراء عنصر",
  gift_sent: "إرسال هدية",
  gift_received: "هدية مستلمة",
  task_reward: "مكافأة مهمة",
  adjust: "تعديل الرصيد",
};

function txIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "recharge":
      return "add-circle";
    case "purchase":
      return "bag-handle";
    case "gift_sent":
      return "gift";
    case "gift_received":
      return "gift-outline";
    case "task_reward":
      return "checkmark-done-circle";
    default:
      return "swap-horizontal";
  }
}

function formatTxDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ar", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const BG = "#13101F";
const CARD = "#1E1830";
const PURPLE = "#7C3AED";
const GOLD = "#F5C242";
const TEXT = "#FFFFFF";
const MUTED = "#9A91B5";

type ResultModal = {
  kind: "success" | "error";
  title: string;
  message: string;
};

export default function RechargeScreen() {
  const insets = useSafeAreaInsets();
  const { user, rechargePackage, reconcileRecharges } = useApp();
  const { purchaseByProductId, isPurchasesSupported } = useRevenueCat();
  const { data, isLoading } = useQuery(getListCoinPackagesQueryOptions());
  const packages = useMemo(
    () =>
      (data ?? [])
        .filter((p) => p.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [data],
  );

  const [tab, setTab] = useState<RechargeTab>("packages");
  const { data: txData, isLoading: txLoading } = useQuery(
    getListWalletTransactionsQueryOptions(user.id),
  );
  const transactions = useMemo(() => txData ?? [], [txData]);

  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPkg, setConfirmPkg] = useState<CoinPackage | null>(null);
  const [result, setResult] = useState<ResultModal | null>(null);
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  // Recovery: when the screen opens, ask the server to credit any purchase that
  // was paid for but never recorded (e.g. the app closed mid-flow). This is
  // idempotent — already-credited purchases are skipped — and silent on success.
  useEffect(() => {
    if (!isPurchasesSupported) return;
    void reconcileRecharges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The native purchase sheet handles the actual payment, so we gate the flow
  // behind an in-app confirmation modal (custom, not Alert) before launching it.
  const requestRecharge = (pkg: CoinPackage) => {
    if (busy) return;
    if (!isPurchasesSupported) {
      setResult({
        kind: "error",
        title: "الشراء غير متاح",
        message:
          "عمليات الشراء داخل التطبيق متاحة فقط على تطبيق الجوال. الرجاء استخدام تطبيق آيفون أو أندرويد.",
      });
      return;
    }
    setConfirmPkg(pkg);
  };

  const confirmRecharge = async () => {
    const pkg = confirmPkg;
    if (!pkg || busy) return;
    setConfirmPkg(null);
    setBusy(true);
    try {
      // 1) Launch the real RevenueCat purchase. Throws on cancel/failure.
      const { rcPurchaseId } = await purchaseByProductId(pkg.productId);
      // 2) Coins are credited only after the server verifies this purchase.
      const res = await rechargePackage(pkg.id, rcPurchaseId);
      if (res.ok) {
        const total = pkg.coins + pkg.bonus;
        setResult({
          kind: "success",
          title: "تم الشحن",
          message: `تمت إضافة ${total.toLocaleString()} كوينز إلى رصيدك`,
        });
      } else {
        setResult({
          kind: "error",
          title: "تعذّر إتمام الشحن",
          message:
            res.error ??
            "تم الدفع لكن تعذّر تأكيد العملية. لن تُخصم منك أي رسوم إضافية، وسيتم إضافة الكوينز عند التحقق.",
        });
      }
    } catch (err) {
      if (err instanceof PurchaseCancelledError) {
        setResult({
          kind: "error",
          title: "تم إلغاء العملية",
          message: "تم إلغاء عملية الشراء ولم تتم إضافة أي كوينز.",
        });
      } else if (err instanceof MissingTransactionIdError) {
        // The store charged the card but didn't hand us a transaction id. The
        // payment is real, so reconcile from the server to credit it instead of
        // reporting a failure.
        const recovered = await reconcileRecharges();
        setResult(
          recovered.ok
            ? {
                kind: "success",
                title: "تم الشحن",
                message: "تم تأكيد عملية الدفع وإضافة الكوينز إلى رصيدك.",
              }
            : {
                kind: "error",
                title: "جارٍ تأكيد الدفع",
                message:
                  "تمت عملية الدفع وسيتم إضافة الكوينز تلقائياً عند التحقق. حدّث الصفحة بعد قليل.",
              },
        );
      } else {
        setResult({
          kind: "error",
          title: "فشل الشراء",
          message:
            err instanceof Error
              ? err.message
              : "تعذّر إتمام عملية الشراء. لم تتم إضافة أي كوينز.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-forward" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>شحن كوينزات</Text>
        <View style={styles.iconBtn} />
      </View>

      <LinearGradient
        colors={["#7C3AED", "#A855F7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceHero}
      >
        <Text style={styles.balanceLabel}>رصيدك الحالي</Text>
        <View style={styles.balanceValueRow}>
          <Ionicons name="logo-bitcoin" size={26} color={GOLD} />
          <Text style={styles.balanceValue}>{user.coins.toLocaleString()}</Text>
        </View>
        <Text style={styles.balanceSub}>اختر باقة لإضافة المزيد من الكوينزات</Text>
      </LinearGradient>

      <View style={styles.tabs}>
        {([
          { k: "packages" as const, l: "الباقات" },
          { k: "history" as const, l: "سجل كوينزات" },
        ]).map((t) => {
          const on = tab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              onPress={() => setTab(t.k)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.l}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === "history" ? (
        txLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={PURPLE} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 40,
            }}
            showsVerticalScrollIndicator={false}
          >
            {transactions.map((tx: WalletTransaction) => {
              const credit = tx.amount >= 0;
              const isV = tx.currency !== "coins";
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: credit ? "#1C3326" : "#33201F" }]}>
                    <Ionicons name={txIcon(tx.type)} size={18} color={credit ? "#22C55E" : "#EF4444"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {tx.description || TX_LABEL[tx.type] || tx.type}
                    </Text>
                    <Text style={styles.txDate}>{formatTxDate(tx.createdAt)}</Text>
                  </View>
                  <View style={styles.txAmountWrap}>
                    <Text style={[styles.txAmount, { color: credit ? "#22C55E" : "#EF4444" }]}>
                      {credit ? "+" : ""}{tx.amount.toLocaleString()}
                    </Text>
                    <Ionicons
                      name={isV ? "diamond" : "logo-bitcoin"}
                      size={11}
                      color={isV ? "#A855F7" : GOLD}
                    />
                  </View>
                </View>
              );
            })}
            {transactions.length === 0 && (
              <Text style={styles.empty}>لا توجد عمليات بعد</Text>
            )}
          </ScrollView>
        )
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PURPLE} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={["#F5C242", "#F59E0B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.promoBanner}
          >
            <View style={styles.promoIcon}>
              <Ionicons name="sync-circle" size={30} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>عجلة الحظ المجانية</Text>
              <Text style={styles.promoSub}>دورة مجانية كل يوم — اربح كوينزات إضافية</Text>
            </View>
            <TouchableOpacity
              style={styles.promoBtn}
              onPress={() =>
                Alert.alert("عجلة الحظ", "ستتوفر عجلة الحظ المجانية قريباً!")
              }
            >
              <Text style={styles.promoBtnText}>أدِر</Text>
            </TouchableOpacity>
          </LinearGradient>

          {packages.map((pkg) => {
            const on = selected === pkg.id;
            const total = pkg.coins + pkg.bonus;
            return (
              <Pressable
                key={pkg.id}
                onPress={() => setSelected(pkg.id)}
                style={[
                  styles.pkgCard,
                  { borderColor: on ? GOLD : "transparent" },
                ]}
              >
                {pkg.popular && (
                  <View style={styles.popularTag}>
                    <Text style={styles.popularText}>الأكثر شعبية</Text>
                  </View>
                )}
                <LinearGradient
                  colors={[pkg.color, pkg.color + "55"]}
                  style={styles.pkgIcon}
                >
                  <Ionicons name={(pkg.icon as never) || "logo-bitcoin"} size={30} color="#fff" />
                </LinearGradient>
                <Text style={styles.pkgName}>{pkg.name}</Text>
                <View style={styles.pkgCoinsRow}>
                  <Ionicons name="logo-bitcoin" size={14} color={GOLD} />
                  <Text style={styles.pkgCoins}>{pkg.coins.toLocaleString()}</Text>
                </View>
                {pkg.bonus > 0 && (
                  <Text style={styles.pkgBonus}>+{pkg.bonus.toLocaleString()} هدية</Text>
                )}
                <View style={styles.pkgPrice}>
                  <Text style={styles.pkgPriceText}>{pkg.price}</Text>
                </View>
                <Text style={styles.pkgTotal}>= {total.toLocaleString()} كوينز</Text>
              </Pressable>
            );
          })}
          {packages.length === 0 && (
            <Text style={styles.empty}>لا توجد باقات متاحة حالياً</Text>
          )}
        </ScrollView>
      )}

      {tab === "packages" && selected !== null && (
        <View style={[styles.footer, { paddingBottom: (Platform.OS === "web" ? 16 : insets.bottom) + 12 }]}>
          <TouchableOpacity
            style={styles.confirmBtn}
            disabled={busy}
            onPress={() => {
              const pkg = packages.find((p) => p.id === selected);
              if (pkg) requestRecharge(pkg);
            }}
          >
            {busy ? (
              <ActivityIndicator color="#3A2E00" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="#3A2E00" />
                <Text style={styles.confirmText}>شحن الآن</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={confirmPkg !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmPkg(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="card" size={28} color={GOLD} />
            </View>
            <Text style={styles.modalTitle}>تأكيد الشراء</Text>
            {confirmPkg && (
              <Text style={styles.modalMessage}>
                {`سيتم شراء "${confirmPkg.name}" مقابل ${confirmPkg.price}\nوستُضاف ${(
                  confirmPkg.coins + confirmPkg.bonus
                ).toLocaleString()} كوينز بعد تأكيد الدفع.`}
              </Text>
            )}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setConfirmPkg(null)}
              >
                <Text style={styles.modalBtnCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={confirmRecharge}
              >
                <Text style={styles.modalBtnConfirmText}>تأكيد الدفع</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={result !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View
              style={[
                styles.modalIconWrap,
                {
                  backgroundColor:
                    result?.kind === "success" ? "#10331F" : "#3A1E1E",
                },
              ]}
            >
              <Ionicons
                name={
                  result?.kind === "success"
                    ? "checkmark-circle"
                    : "close-circle"
                }
                size={30}
                color={result?.kind === "success" ? "#22C55E" : "#EF4444"}
              />
            </View>
            <Text style={styles.modalTitle}>{result?.title}</Text>
            <Text style={styles.modalMessage}>{result?.message}</Text>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnConfirm, { width: "100%" }]}
              onPress={() => setResult(null)}
            >
              <Text style={styles.modalBtnConfirmText}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: TEXT, fontSize: 20, fontWeight: "800" },
  balanceHero: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  balanceLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  balanceValueRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  balanceValue: { color: "#fff", fontSize: 30, fontWeight: "900" },
  balanceSub: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: CARD,
  },
  tabOn: { backgroundColor: "#2E2640", borderWidth: 1, borderColor: GOLD },
  tabText: { color: MUTED, fontSize: 13, fontWeight: "700" },
  tabTextOn: { color: GOLD },
  promoBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
  },
  promoIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  promoTitle: { color: "#3A2E00", fontSize: 15, fontWeight: "900" },
  promoSub: { color: "#5A4A10", fontSize: 11, fontWeight: "600", marginTop: 2 },
  promoBtn: {
    backgroundColor: "#3A2E00",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  promoBtnText: { color: GOLD, fontSize: 13, fontWeight: "800" },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  txTitle: { color: TEXT, fontSize: 13, fontWeight: "700" },
  txDate: { color: MUTED, fontSize: 11, marginTop: 2 },
  txAmountWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  txAmount: { fontSize: 14, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
    justifyContent: "center",
  },
  pkgCard: {
    width: "44%",
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 2,
  },
  popularTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 2,
  },
  popularText: { color: "#3A2E00", fontSize: 9, fontWeight: "800" },
  pkgIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  pkgName: { color: TEXT, fontSize: 14, fontWeight: "700", marginBottom: 6 },
  pkgCoinsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pkgCoins: { color: GOLD, fontSize: 18, fontWeight: "900" },
  pkgBonus: { color: "#22C55E", fontSize: 11, fontWeight: "700", marginTop: 2 },
  pkgPrice: {
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginTop: 10,
  },
  pkgPriceText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  pkgTotal: { color: MUTED, fontSize: 10, marginTop: 6 },
  empty: { color: MUTED, fontSize: 14, textAlign: "center", width: "100%", marginTop: 40 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "rgba(19,16,31,0.95)",
    borderTopWidth: 1,
    borderTopColor: "#2E2640",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 26,
    paddingVertical: 14,
  },
  confirmText: { color: "#3A2E00", fontSize: 16, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    width: "100%",
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2E2640",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: { color: TEXT, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  modalMessage: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 20,
  },
  modalBtnRow: { flexDirection: "row", gap: 10, width: "100%" },
  modalBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
  },
  modalBtnCancel: { backgroundColor: "#2E2640" },
  modalBtnCancelText: { color: MUTED, fontSize: 15, fontWeight: "700" },
  modalBtnConfirm: { backgroundColor: GOLD },
  modalBtnConfirmText: { color: "#3A2E00", fontSize: 15, fontWeight: "800" },
});
