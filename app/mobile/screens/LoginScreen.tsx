/**
 * VYENFITA Mobile Login Screen
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import config from '../config';

export default function LoginScreen({ navigation }: any) {
  const { login, biometricAvailable, biometricEnabled, authenticateWithBiometric } = useAuth();
  const { colors, spacing, fontSize, borderRadius, shadows } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  useEffect(() => {
    (async () => {
      const lastEmail = await SecureStore.getItemAsync(config.storageKeys.lastEmail);
      if (lastEmail) setEmail(lastEmail);
    })();
  }, []);

  useEffect(() => {
    if (biometricAvailable && biometricEnabled && !showBiometricPrompt) {
      setShowBiometricPrompt(true);
      (async () => {
        const success = await authenticateWithBiometric();
        if (!success) setShowBiometricPrompt(false);
      })();
    }
  }, [biometricAvailable, biometricEnabled]);

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await login(email, password, tenantId);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    scrollContent: {
      flexGrow: 1,
      padding: spacing.xl,
      justifyContent: 'center',
    },
    logo: {
      fontSize: 48,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.brand.primary,
      marginBottom: spacing.xs,
    },
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      textAlign: 'center',
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: fontSize.base,
      textAlign: 'center',
      color: colors.text.secondary,
      marginBottom: spacing['2xl'],
    },
    errorBox: {
      backgroundColor: colors.semantic.errorLight,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.lg,
    },
    errorText: {
      color: colors.semantic.error,
      fontSize: fontSize.sm,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.base,
      color: colors.text.primary,
    },
    button: {
      backgroundColor: colors.brand.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.xl,
      ...shadows.md,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.text.inverse,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    biometricButton: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      alignItems: 'center',
    },
    biometricText: {
      color: colors.brand.primary,
      fontSize: fontSize.base,
      fontWeight: '600',
    },
    footer: {
      marginTop: spacing.xl,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    footerText: {
      color: colors.text.secondary,
      fontSize: fontSize.sm,
    },
    footerLink: {
      color: colors.brand.primary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>V</Text>
          <Text style={styles.title}>VYENFITA</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry
            autoComplete="password"
          />

          <Text style={styles.label}>Tenant ID</Text>
          <TextInput
            style={styles.input}
            value={tenantId}
            onChangeText={setTenantId}
            placeholder="Your tenant UUID"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {biometricAvailable && biometricEnabled ? (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={async () => {
                const success = await authenticateWithBiometric();
                if (!success) Alert.alert('Authentication failed');
              }}
            >
              <Text style={styles.biometricText}>🔐 Sign in with Biometric</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
        }
