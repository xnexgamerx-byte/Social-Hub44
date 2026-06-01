import { Ionicons } from "@expo/vector-icons";
import { useSignIn, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
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
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setFormError("تعذّر تسجيل الدخول. تحقّق من البريد وكلمة المرور.");
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: finishNavigate });
    } else {
      setFormError("تعذّر إكمال تسجيل الدخول.");
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
      setFormError("تعذّر تسجيل الدخول عبر Google.");
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, router]);

  const busy = fetchStatus === "fetching";
  const fieldError = errors?.fields?.identifier?.message ?? errors?.fields?.password?.message;

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
            <Text style={styles.cardTitle}>تسجيل الدخول</Text>
            <Text style={styles.cardSub}>أهلاً بعودتك! سجّل دخولك للمتابعة</Text>

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

            {(formError || fieldError) && (
              <Text style={styles.error}>{formError ?? fieldError}</Text>
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
                <Text style={styles.primaryBtnText}>دخول</Text>
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
              <Link href="/(auth)/sign-up" asChild>
                <Pressable>
                  <Text style={styles.linkText}>إنشاء حساب</Text>
                </Pressable>
              </Link>
              <Text style={styles.footerText}>ليس لديك حساب؟ </Text>
            </View>
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
