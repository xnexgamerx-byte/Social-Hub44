import { useSignIn } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
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

/**
 * Three-step reset on Clerk's `resetPasswordEmailCode` flow: identify the
 * account, verify the emailed code, then submit a new password. Without this
 * an account whose password is forgotten is simply lost.
 *
 * Navigation after success is left to AuthGate, which owns auth redirects.
 */
export default function ResetPasswordScreen() {
  const { signIn } = useSignIn();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<"request" | "verify">("request");
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      // `create` identifies the account; the code then goes to its email.
      const created = await signIn.create({ identifier: emailAddress.trim() });
      if (created.error) {
        setError(clerkErrorMessage(created.error, "لا يوجد حساب بهذا البريد."));
        return;
      }
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) {
        setError(clerkErrorMessage(sent.error, "تعذّر إرسال رمز الاستعادة."));
        return;
      }
      setStep("verify");
    } catch (err) {
      setError(clerkErrorMessage(err, "تعذّر إرسال رمز الاستعادة."));
    } finally {
      setBusy(false);
    }
  }, [signIn, emailAddress]);

  const confirmReset = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const verified = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (verified.error) {
        setError(clerkErrorMessage(verified.error, "الرمز غير صحيح."));
        return;
      }
      const submitted = await signIn.resetPasswordEmailCode.submitPassword({ password });
      if (submitted.error) {
        setError(clerkErrorMessage(submitted.error, "كلمة المرور ضعيفة جداً."));
        return;
      }
      if (signIn.status === "complete") {
        // A successful reset also signs the user in; AuthGate handles routing.
        await signIn.finalize();
      } else {
        setError("تعذّر إكمال الاستعادة. حاول مرة أخرى.");
      }
    } catch (err) {
      setError(clerkErrorMessage(err, "تعذّر إكمال الاستعادة."));
    } finally {
      setBusy(false);
    }
  }, [signIn, code, password]);

  const canRequest = emailAddress.trim().length > 3 && !busy;
  const canConfirm = code.trim().length >= 4 && password.length >= 8 && !busy;

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0D0320", "#1A0640", "#2A0E6B"]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["#6B21E8", "#4C1D95"]} style={styles.blobTopRight} />
      <LinearGradient colors={["#7C3AED", "#5B21B6"]} style={styles.blobBottomLeft} />

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
          <BlurView intensity={25} tint="dark" style={styles.card}>
            <View style={styles.cardInner}>
              <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </Pressable>

              <Text style={styles.title}>استعادة كلمة المرور</Text>
              <Text style={styles.subtitle}>
                {step === "request"
                  ? "أدخل بريدك وسنرسل لك رمزاً لإعادة التعيين"
                  : `أرسلنا رمزاً إلى ${emailAddress.trim()}`}
              </Text>

              {step === "request" ? (
                <>
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
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      !canRequest && styles.btnDisabled,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={sendCode}
                    disabled={!canRequest}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryText}>إرسال الرمز</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.label}>رمز التحقق</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="123456"
                    placeholderTextColor="rgba(200,180,255,0.45)"
                    value={code}
                    onChangeText={setCode}
                    maxLength={8}
                    textAlign="center"
                  />

                  <Text style={styles.label}>كلمة المرور الجديدة</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    placeholder="٨ أحرف على الأقل"
                    placeholderTextColor="rgba(200,180,255,0.45)"
                    value={password}
                    onChangeText={setPassword}
                    textAlign="right"
                  />

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      !canConfirm && styles.btnDisabled,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={confirmReset}
                    disabled={!canConfirm}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryText}>تعيين كلمة المرور</Text>
                    )}
                  </Pressable>

                  <Pressable style={styles.resend} onPress={sendCode} disabled={busy}>
                    <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
                  </Pressable>
                </>
              )}
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
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
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
  back: { alignSelf: "flex-start", padding: 4, marginBottom: 8 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: {
    color: "rgba(220,200,255,0.8)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    color: "rgba(220,200,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "right",
  },
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
  error: { color: "#F87171", fontSize: 13, marginBottom: 12, textAlign: "right" },
  primaryBtn: {
    backgroundColor: "#8B5CF6",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.8 },
  resend: { alignItems: "center", paddingVertical: 16 },
  resendText: { color: "rgba(200,180,255,0.8)", fontSize: 14, fontWeight: "600" },
});
