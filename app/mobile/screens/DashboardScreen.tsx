/**
 * VYENFITA Mobile Dashboard Screen
 * 
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function DashboardScreen({ navigation }: any) {
  const { tenant } = useAuth();
  const { colors, spacing, fontSize, borderRadius, shadows } = useTheme();

  const [stats, setStats] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [statsData, appsData, wfData] = await Promise.all([
        api.getTenantStats(),
        api.listApplications({ limit: 5 }),
        api.listWorkflows({ limit: 5 }),
      ]);
      setStats(statsData);
      setApps(appsData.data || []);
      setWorkflows(wfData.data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.tertiary },
    scroll: { padding: spacing.lg },
    header: { marginBottom: spacing.xl },
    greeting: { fontSize: fontSize.sm, color: colors.text.secondary },
    title: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.text.primary, marginTop: spacing.xs },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.background.primary,
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      ...shadows.sm,
    },
    statIcon: { fontSize: 24, marginBottom: spacing.sm },
    statValue: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.text.primary },
    statLabel: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.xs },
    section: { marginBottom: spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary },
    sectionLink: { fontSize: fontSize.sm, color: colors.brand.primary, fontWeight: '600' },
    listItem: {
      backgroundColor: colors.background.primary,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemName: { fontSize: fontSize.base, fontWeight: '600', color: colors.text.primary, flex: 1 },
    itemMeta: { fontSize: fontSize.xs, color: colors.text.tertiary, marginTop: spacing.xs },
    statusBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: borderRadius.full },
    statusText: { fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
    empty: { padding: spacing.xl, textAlign: 'center', color: colors.text.tertiary, fontSize: fontSize.sm },
    error: { backgroundColor: colors.semantic.errorLight, padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md },
    errorText: { color: colors.semantic.error, fontSize: fontSize.sm },
  });

  const getStatusStyle = (status: string) => {
    const map: any = {
      published: { bg: colors.semantic.successLight, color: colors.semantic.success },
      active: { bg: colors.semantic.successLight, color: colors.semantic.success },
      draft: { bg: colors.neutral[200], color: colors.neutral[700] },
      paused: { bg: colors.semantic.warningLight, color: colors.semantic.warning },
    };
    return map[status] || map.draft;
  };

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
          <Text style={styles.greeting}>Welcome back to</Text>
          <Text style={styles.title}>{tenant?.name || 'VYENFITA'}</Text>
        </View>

        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.statsGrid}>
          <StatCard icon="👥" value={stats?.members || 0} label="Team Members" styles={styles} />
          <StatCard icon="📱" value={stats?.applications || 0} label="Applications" styles={styles} />
          <StatCard icon="⚡" value={stats?.workflows || 0} label="Workflows" styles={styles} />
          <StatCard icon="📋" value={stats?.auditEvents || 0} label="Audit Events" styles={styles} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Applications</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Applications')}>
              <Text style={styles.sectionLink}>View all →</Text>
            </TouchableOpacity>
          </View>
          {apps.length === 0 ? (
            <Text style={styles.empty}>No applications yet</Text>
          ) : (
            apps.map((app) => {
              const s = getStatusStyle(app.status);
              return (
                <TouchableOpacity key={app.id} style={styles.listItem} onPress={() => {}}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{app.name}</Text>
                    <Text style={styles.itemMeta}>{app.description || 'No description'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.statusText, { color: s.color }]}>{app.status}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Workflows</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Workflows')}>
              <Text style={styles.sectionLink}>View all →</Text>
            </TouchableOpacity>
          </View>
          {workflows.length === 0 ? (
            <Text style={styles.empty}>No workflows yet</Text>
          ) : (
            workflows.map((wf) => {
              const s = getStatusStyle(wf.status);
              return (
                <View key={wf.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{wf.name}</Text>
                    <Text style={styles.itemMeta}>{wf.description || 'No description'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.statusText, { color: s.color }]}>{wf.status}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label, styles }: any) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
         }
