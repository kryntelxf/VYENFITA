/**
 * VYENFITA Mobile Register Screen
 * 
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const { colors, spacing, fontSize, borderRadius, shadows } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    setIsLoading(true);
    try {
      await register({ email, password, name, tenantName: tenantName || undefined });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    scrollContent: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
    logo: { fontSize: 48, fontWeight: '700', textAlign: 'center', color: colors.brand.primary, marginBottom: spacing.xs },
    title: { fontSize: fontSize['2xl'], fontWeight: '700', textAlign: 'center', color: colors.text.primary, marginBottom: spacing.xs },
    subtitle: { fontSize: fontSize.base, textAlign: 'center', color: colors.text.secondary, marginBottom: spacing['2xl'] },
    errorBox: { backgroundColor: colors.semantic.errorLight, padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.lg },
    errorText: { color: colors.semantic.error, fontSize: fontSize.sm },
    label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.xs, marginTop: spacing.md },
    input: { backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.default, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: fontSize.base, color: colors.text.primary },
    hint: { fontSize: fontSize.xs, color: colors.text.tertiary, marginTop: spacing.xs },
    button: { backgroundColor: colors.brand.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl, ...shadows.md },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.text.inverse, fontSize: fontSize.lg, fontWeight: '600' },
    footer: { marginTop: spacing.xl, flexDirection: 'row', justifyContent: 'center' },
    footerText: { color: colors.text.secondary, fontSize: fontSize.sm },
    footerLink: { color: colors.brand.primary, fontSize: fontSize.sm, fontWeight: '600' },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>V</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Get started with VYENFITA</Text>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={colors.text.tertiary} />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.text.tertiary} autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min 8 chars" placeholderTextColor={colors.text.tertiary} secureTextEntry />
          <Text style={styles.hint}>Must include uppercase, lowercase, and a number</Text>

          <Text style={styles.label}>Organization Name (optional)</Text>
          <TextInput style={styles.input} value={tenantName} onChangeText={setTenantName} placeholder="My Company" placeholderTextColor={colors.text.tertiary} />

          <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.buttonText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
