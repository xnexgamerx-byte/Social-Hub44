import { Ionicons } from "@expo/vector-icons";
import { useSignIn, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
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

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
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

  // Navigation after a session becomes active is owned solely by AuthGate in
  // the root layout, which waits for the root navigator to mount before
  // redirecting. Replacing the route from here too raced that mount and threw
  // "The action 'REPLACE' ... was not handled by any navigator".
  const finishNavigate = useCallback(() => {}, []);

  const handleSubmit = async () => {
    setFormError(null);
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setFormError(
        clerkErrorMessage(error, "تعذّر تسجيل الدخول. تحقّق من البريد وكلمة المرور."),
      );
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
        // AuthGate redirects once the session is active — see finishNavigate.
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      setFormError(clerkErrorMessage(err, "تعذّر تسجيل الدخول عبر Google."));
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow]);

  const busy = fetchStatus === "fetching";
  // Coerce to null rather than testing the string with `&&`: an empty message
  // from Clerk would otherwise be rendered as a bare string and crash RN.
  const errorText =
    formError ||
    errors?.fields?.identifier?.message ||
    errors?.fields?.password?.message ||
    null;

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

              {/* Welcome heading */}
              <Text style={styles.welcomeTitle}>أهلاً بعودتك!</Text>

              {/* Email field */}
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

              {/* Password field */}
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

              {/* Forgot password */}
              <Pressable
                style={styles.forgotRow}
                onPress={() => router.push("/(auth)/reset-password")}
              >
                <Text style={styles.forgotText}>نسيت كلمة المرور؟</Text>
              </Pressable>

              {/* Error */}
              {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

              {/* Login button */}
              <Pressable
                style={({ pressed }) => [
                  styles.loginBtn,
                  (!emailAddress || !password || busy) && styles.btnDisabled,
                  pressed && styles.btnPressed,
                ]}
                onPress={handleSubmit}
                disabled={!emailAddress || !password || busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginBtnText}>دخول</Text>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>أو</Text>
                <View style={styles.divider} />
              </View>

              {/* Google button */}
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

              {/* Footer */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>ليس لديك حساب؟ </Text>
                <Link href="/(auth)/sign-up" asChild>
                  <Pressable>
                    <Text style={styles.footerLink}>إنشاء حساب</Text>
                  </Pressable>
                </Link>
              </View>
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
    marginBottom: 26,
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

  /* Forgot */
  forgotRow: { alignItems: "flex-start", marginBottom: 20 },
  forgotText: {
    color: "rgba(200,180,255,0.75)",
    fontSize: 13,
  },

  /* Error */
  error: {
    color: "#F87171",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "right",
  },

  /* Login button */
  loginBtn: {
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
  loginBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.8 },

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
