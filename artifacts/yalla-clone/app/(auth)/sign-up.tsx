import { Ionicons } from "@expo/vector-icons";
import { useSignUp, useSSO } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import { BlurView } from "expo-blur";
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
import { clerkErrorMessage } from "@/lib/clerkError";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [age, setAge] = useState("");
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
    ({ session }: { session?: { currentTask?: unknown }; decorateUrl: (u: string) => string }) => {
      if (session?.currentTask) return;
      router.replace("/(tabs)" as Href);
    },
    [router],
  );

  const handleSubmit = async () => {
    setFormError(null);
    const ageNum = Number(age);
    if (!username.trim()) {
      setFormError("الرجاء إدخال اسم المستخدم.");
      return;
    }
    if (!gender) {
      setFormError("الرجاء اختيار الجنس.");
      return;
    }
    if (!age || Number.isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
      setFormError("الرجاء إدخال عمر صحيح (13 فأكثر).");
      return;
    }
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setFormError(clerkErrorMessage(error, "تعذّر إنشاء الحساب. تحقّق من البيانات."));
      return;
    }
    // Stash the profile details, scoped to this email so AppContext only ever
    // applies them to the matching account once its session becomes active
    // (the sign-up flow itself only sets credentials).
    await AsyncStorage.setItem(
      "pendingProfile",
      JSON.stringify({
        email: emailAddress.trim().toLowerCase(),
        username: username.trim(),
        gender,
        age: ageNum,
      }),
    );
    await signUp.verifications.sendEmailCode();
    setPendingVerify(true);
  };

  const handleVerify = async () => {
    setFormError(null);
    try {
      await signUp.verifications.verifyEmailCode({ code });
      if (signUp.status === "complete") {
        await signUp.finalize({ navigate: finishNavigate });
      } else {
        setFormError("رمز التحقق غير صحيح.");
      }
    } catch (err) {
      setFormError(clerkErrorMessage(err, "تعذّر التحقق من الرمز. حاول مرة أخرى."));
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
    } catch (err) {
      setFormError(clerkErrorMessage(err, "تعذّر المتابعة عبر Google."));
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, router]);

  const busy = fetchStatus === "fetching";

  return (
    <View style={styles.root}>
      {/* Deep purple base */}
      <LinearGradient
        colors={["#0D0320", "#1A0640", "#2A0E6B"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Flowing blob — top right */}
      <LinearGradient
        colors={["#6B21E8", "#4C1D95"]}
        style={styles.blobTopRight}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Flowing blob — bottom left */}
      <LinearGradient
        colors={["#7C3AED", "#5B21B6"]}
        style={styles.blobBottomLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Flowing blob — center accent */}
      <LinearGradient
        colors={["#9333EA", "#6D28D9"]}
        style={styles.blobCenter}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Glass card */}
          <BlurView intensity={25} tint="dark" style={styles.card}>
            <View style={styles.cardInner}>
              {/* Logo icon */}
              <View style={styles.logoWrap}>
                <View style={styles.logoStripe1} />
                <View style={styles.logoStripe2} />
              </View>

              {/* Brand name */}
              <Text style={styles.brandName}>Viber Tok</Text>

              {pendingVerify ? (
                /* ── Verification step ── */
                <>
                  <Text style={styles.welcomeTitle}>تأكيد البريد</Text>
                  <Text style={styles.subTitle}>
                    أدخل الرمز المرسل إلى{"\n"}{emailAddress}
                  </Text>

                  <Text style={styles.label}>رمز التحقق</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="123456"
                    placeholderTextColor="rgba(200,180,255,0.45)"
                    value={code}
                    onChangeText={setCode}
                    textAlign="right"
                  />

                  {(formError || errors?.fields?.code?.message) && (
                    <Text style={styles.error}>
                      {formError ?? errors?.fields?.code?.message}
                    </Text>
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
                    <Text style={styles.footerLink}>إعادة إرسال الرمز</Text>
                  </Pressable>
                </>
              ) : (
                /* ── Registration step ── */
                <>
                  <Text style={styles.welcomeTitle}>إنشاء حساب جديد</Text>

                  <Text style={styles.label}>البريد الإلكتروني</Text>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="example@email.com"
                    placeholderTextColor="rgba(200,180,255,0.45)"
                    value={emailAddress}
                    onChangeText={setEmailAddress}
                    textAlign="right"
                  />

                  <Text style={styles.label}>كلمة المرور</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="rgba(200,180,255,0.45)"
                    value={password}
                    onChangeText={setPassword}
                    textAlign="right"
                  />

                  <Text style={styles.label}>اسم المستخدم</Text>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    placeholder="username"
                    placeholderTextColor="rgba(200,180,255,0.45)"
                    value={username}
                    onChangeText={setUsername}
                    textAlign="right"
                  />

                  <Text style={styles.label}>الجنس</Text>
                  <View style={styles.genderRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.genderBtn,
                        gender === "male" && styles.genderBtnOn,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => setGender("male")}
                    >
                      <Ionicons
                        name="male"
                        size={18}
                        color={gender === "male" ? "#fff" : "rgba(200,180,255,0.7)"}
                      />
                      <Text
                        style={[styles.genderText, gender === "male" && styles.genderTextOn]}
                      >
                        ذكر
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.genderBtn,
                        gender === "female" && styles.genderBtnOn,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => setGender("female")}
                    >
                      <Ionicons
                        name="female"
                        size={18}
                        color={gender === "female" ? "#fff" : "rgba(200,180,255,0.7)"}
                      />
                      <Text
                        style={[styles.genderText, gender === "female" && styles.genderTextOn]}
                      >
                        أنثى
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>العمر</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="18"
                    placeholderTextColor="rgba(200,180,255,0.45)"
                    value={age}
                    onChangeText={setAge}
                    maxLength={3}
                    textAlign="right"
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
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="logo-google" size={18} color="#fff" />
                        <Text style={styles.googleBtnText}>المتابعة عبر Google</Text>
                      </>
                    )}
                  </Pressable>

                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>لديك حساب بالفعل؟ </Text>
                    <Link href="/(auth)/sign-in" asChild>
                      <Pressable>
                        <Text style={styles.footerLink}>تسجيل الدخول</Text>
                      </Pressable>
                    </Link>
                  </View>
                </>
              )}

              {/* Required for Clerk bot protection */}
              <View nativeID="clerk-captcha" />
            </View>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const CARD_RADIUS = 28;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0320" },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  /* Background blobs */
  blobTopRight: {
    position: "absolute",
    width: 340,
    height: 460,
    borderRadius: 999,
    top: -120,
    right: -130,
    transform: [{ rotate: "30deg" }],
    opacity: 0.75,
  },
  blobBottomLeft: {
    position: "absolute",
    width: 300,
    height: 420,
    borderRadius: 999,
    bottom: -140,
    left: -120,
    transform: [{ rotate: "-20deg" }],
    opacity: 0.8,
  },
  blobCenter: {
    position: "absolute",
    width: 220,
    height: 300,
    borderRadius: 999,
    top: "40%",
    left: -80,
    transform: [{ rotate: "15deg" }],
    opacity: 0.45,
  },

  /* Glassmorphism card */
  card: {
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(180,140,255,0.25)",
  },
  cardInner: {
    backgroundColor: "rgba(60,20,120,0.35)",
    padding: 28,
    borderRadius: CARD_RADIUS,
  },

  /* Logo */
  logoWrap: {
    alignSelf: "center",
    width: 52,
    height: 52,
    marginBottom: 8,
    position: "relative",
  },
  logoStripe1: {
    position: "absolute",
    width: 14,
    height: 44,
    borderRadius: 7,
    backgroundColor: "#A78BFA",
    top: 0,
    left: 10,
    transform: [{ rotate: "-20deg" }],
  },
  logoStripe2: {
    position: "absolute",
    width: 14,
    height: 44,
    borderRadius: 7,
    backgroundColor: "#7C3AED",
    top: 6,
    left: 26,
    transform: [{ rotate: "-20deg" }],
  },

  /* Text */
  brandName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 18,
    opacity: 0.9,
  },
  welcomeTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subTitle: {
    color: "rgba(220,200,255,0.7)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 22,
    lineHeight: 20,
  },
  label: {
    color: "rgba(220,200,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "right",
  },

  /* Inputs */
  input: {
    borderWidth: 1.5,
    borderColor: "rgba(180,140,255,0.4)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#fff",
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  /* Gender selector */
  genderRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "rgba(180,140,255,0.4)",
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  genderBtnOn: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  genderText: { color: "rgba(220,200,255,0.85)", fontSize: 15, fontWeight: "600" },
  genderTextOn: { color: "#fff", fontWeight: "700" },

  /* Error */
  error: {
    color: "#F87171",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "right",
  },

  /* Primary button */
  primaryBtn: {
    backgroundColor: "#8B5CF6",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 4,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.8 },

  /* Resend */
  resendBtn: { alignItems: "center", marginTop: 18 },

  /* Divider */
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    gap: 12,
  },
  divider: { flex: 1, height: 1, backgroundColor: "rgba(180,140,255,0.2)" },
  dividerText: { color: "rgba(200,180,255,0.6)", fontSize: 13 },

  /* Google button */
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "rgba(180,140,255,0.35)",
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginBottom: 4,
  },
  googleBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  /* Footer */
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  footerText: { color: "rgba(200,180,255,0.65)", fontSize: 14 },
  footerLink: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
