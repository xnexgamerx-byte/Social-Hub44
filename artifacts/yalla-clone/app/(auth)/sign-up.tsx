import { Ionicons } from "@expo/vector-icons";
import { useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerify, setPendingVerify] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const finishNavigate = useCallback(
    ({ session, decorateUrl }: { session?: { currentTask?: unknown }; decorateUrl: (u: string) => string }) => {
      if (session?.currentTask) return;
      const url = decorateUrl("/(tabs)");
      router.replace(url as Href);
    },
    [router],
  );

  const handleSubmit = async () => {
    setFormError(null);
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setFormError("تعذّر إنشاء الحساب. تحقّق من البيانات.");
      return;
    }
    await signUp.verifications.sendEmailCode();
    setPendingVerify(true);
  };

  const handleVerify = async () => {
    setFormError(null);
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: finishNavigate });
    } else {
      setFormError("رمز التحقق غير صحيح.");
    }
  };

  const handleGoogle = useCallback(async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/(tabs)");
          },
        });
      }
    } catch {
      setFormError("تعذّر المتابعة عبر Google.");
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, router]);

  const busy = fetchStatus === "fetching";

  return (
    <LinearGradient colors={["#2B1B5A", "#4C1D95", "#7C5CFC"]} style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Ionicons name="pulse" size={40} color="#fff" />
            </View>
            <Text style={styles.brandTitle}>نبضة</Text>
            <Text style={styles.brandSub}>دردشة وترفيه</Text>
          </View>

          <View style={styles.card}>
            {pendingVerify ? (
              <>
                <Text style={styles.cardTitle}>تأكيد البريد</Text>
                <Text style={styles.cardSub}>
                  أدخل الرمز المرسل إلى {emailAddress}
                </Text>
                <Text style={styles.label}>رمز التحقق</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="123456"
                  placeholderTextColor="#9B9BB4"
                  value={code}
                  onChangeText={setCode}
                />
                {(formError || errors?.fields?.code?.message) && (
                  <Text style={styles.error}>{formError ?? errors?.fields?.code?.message}</Text>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (!code || busy) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleVerify}
                  disabled={!code || busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>تأكيد</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.resendBtn}
                  onPress={() => signUp.verifications.sendEmailCode()}
                >
                  <Text style={styles.linkText}>إعادة إرسال الرمز</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>إنشاء حساب</Text>
                <Text style={styles.cardSub}>انضم إلى نبضة وابدأ المتعة</Text>

                <Text style={styles.label}>البريد الإلكتروني</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="example@email.com"
                  placeholderTextColor="#9B9BB4"
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                />

                <Text style={styles.label}>كلمة المرور</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#9B9BB4"
                  value={password}
                  onChangeText={setPassword}
                />

                {(formError ||
                  errors?.fields?.emailAddress?.message ||
                  errors?.fields?.password?.message) && (
                  <Text style={styles.error}>
                    {formError ??
                      errors?.fields?.emailAddress?.message ??
                      errors?.fields?.password?.message}
                  </Text>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (!emailAddress || !password || busy) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleSubmit}
                  disabled={!emailAddress || !password || busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>إنشاء حساب</Text>
                  )}
                </Pressable>

                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>أو</Text>
                  <View style={styles.divider} />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.googleBtn,
                    googleLoading && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleGoogle}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#1A1A2E" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={20} color="#EA4335" />
                      <Text style={styles.googleBtnText}>المتابعة عبر Google</Text>
                    </>
                  )}
                </Pressable>

                <View style={styles.footerRow}>
                  <Link href="/(auth)/sign-in" asChild>
                    <Pressable>
                      <Text style={styles.linkText}>تسجيل الدخول</Text>
                    </Pressable>
                  </Link>
                  <Text style={styles.footerText}>لديك حساب بالفعل؟ </Text>
                </View>
              </>
            )}

            {/* Required for sign-up flows — Clerk bot protection */}
            <View nativeID="clerk-captcha" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  brand: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  brandTitle: { color: "#fff", fontSize: 38, fontWeight: "900" as const },
  brandSub: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 2 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: {
    color: "#1A1A2E",
    fontSize: 24,
    fontWeight: "800" as const,
    textAlign: "right",
  },
  cardSub: {
    color: "#9B9BB4",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
    textAlign: "right",
  },
  label: {
    color: "#1A1A2E",
    fontSize: 13,
    fontWeight: "700" as const,
    marginBottom: 6,
    textAlign: "right",
  },
  input: {
    backgroundColor: "#F0EEFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1A1A2E",
    marginBottom: 14,
    textAlign: "right",
  },
  error: { color: "#EF4444", fontSize: 13, marginBottom: 12, textAlign: "right" },
  primaryBtn: {
    backgroundColor: "#7C5CFC",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" as const },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  resendBtn: { alignItems: "center", marginTop: 16 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 18, gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: "#EAE6FF" },
  dividerText: { color: "#9B9BB4", fontSize: 13 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#EAE6FF",
    borderRadius: 14,
    paddingVertical: 14,
  },
  googleBtnText: { color: "#1A1A2E", fontSize: 15, fontWeight: "700" as const },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  footerText: { color: "#9B9BB4", fontSize: 14 },
  linkText: { color: "#7C5CFC", fontSize: 14, fontWeight: "800" as const },
});
