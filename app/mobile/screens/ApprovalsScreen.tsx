/**
 * VYENFITA Mobile Approvals Screen
 * 
 * Critical for approvals on-the-go.
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useTheme } from '../contexts/ThemeContext';

export default function ApprovalsScreen() {
  const { colors, spacing, fontSize, borderRadius, shadows } = useTheme();

  const [approvals, setApprovals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadApprovals = async () => {
    try {
      const pending = await api.listPendingApprovals();
      setApprovals(pending);
    } catch {
      setApprovals([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadApprovals(); }, []));

  const onRefresh = () => { setRefreshing(true); loadApprovals(); };

  const handleApprove = async (id: string) => {
    Alert.alert('Approve?', 'Are you sure you want to approve this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setProcessingId(id);
          try {
            await api.approveApproval(id);
            await loadApprovals();
            Alert.alert('✓ Approved');
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  };

  const handleReject = async (id: string) => {
    Alert.prompt?.(
      'Reject?',
      'Reason (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason?: string) => {
            setProcessingId(id);
            try {
              await api.rejectApproval(id, reason);
              await loadApprovals();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
      'plain-text'
    ) || handleRejectFallback(id);
  };

  const handleRejectFallback = async (id: string) => {
    setProcessingId(id);
    try {
      await api.rejectApproval(id);
      await loadApprovals();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.tertiary },
    scroll: { padding: spacing.lg },
    header: { marginBottom: spacing.xl },
    title: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.text.primary },
    subtitle: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.xs },
    empty: {
      backgroundColor: colors.background.primary,
      padding: spacing['2xl'],
      borderRadius: borderRadius.xl,
      textAlign: 'center',
      color: colors.text.tertiary,
      fontSize: fontSize.base,
      ...shadows.sm,
    },
    card: {
      backgroundColor: colors.background.primary,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.sm,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
    cardTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.text.primary, flex: 1 },
    cardTime: { fontSize: fontSize.xs, color: colors.text.tertiary },
    cardMessage: { fontSize: fontSize.sm, color: colors.text.secondary, marginBottom: spacing.md },
    cardMeta: { fontSize: fontSize.xs, color: colors.text.tertiary, marginBottom: spacing.md },
    actions: { flexDirection: 'row', gap: spacing.sm },
    actionBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
    },
    approveBtn: { backgroundColor: colors.semantic.success },
    rejectBtn: { backgroundColor: colors.semantic.error },
    actionText: { color: colors.text.inverse, fontSize: fontSize.sm, fontWeight: '600' },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Approvals</Text>
          <Text style={styles.subtitle}>
            {approvals.length} pending {approvals.length === 1 ? 'request' : 'requests'}
          </Text>
        </View>

        {approvals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 32, marginBottom: spacing.md }}>✓</Text>
            <Text>No pending approvals</Text>
          </View>
        ) : (
          approvals.map((a: any) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{a.workflowName || 'Workflow Approval'}</Text>
                <Text style={styles.cardTime}>
                  {new Date(a.requestedAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.cardMessage}>{a.message || 'Please review and approve'}</Text>
              <Text style={styles.cardMeta}>
                From: {a.requesterName || 'System'} · {a.approvers?.length || 1} approver(s)
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleApprove(a.id)}
                  disabled={processingId === a.id}
                >
                  {processingId === a.id ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.actionText}>✓ Approve</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(a.id)}
                  disabled={processingId === a.id}
                >
                  <Text style={styles.actionText}>✕ Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
        }
