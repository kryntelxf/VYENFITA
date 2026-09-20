/**
 * VYENFITA Mobile App
 * 
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import ApplicationsScreen from './screens/ApplicationsScreen';
import WorkflowsScreen from './screens/WorkflowsScreen';
import ApprovalsScreen from './screens/ApprovalsScreen';
import SettingsScreen from './screens/SettingsScreen';
import NotificationsScreen from './screens/NotificationsScreen';

import LoadingScreen from './screens/LoadingScreen';
import { colors } from './theme';

// Notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const linking = {
  prefixes: [Linking.createURL('/'), 'vyenfita://'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Applications: 'applications',
          Workflows: 'workflows',
          Approvals: 'approvals',
          Settings: 'settings',
        },
      },
    },
  },
};

// ============================================================
// AUTH STACK
// ============================================================

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// ============================================================
// MAIN TABS
// ============================================================

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          borderTopColor: colors.border.default,
          backgroundColor: colors.background.primary,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <TabIcon name="📊" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{
          tabBarLabel: 'Apps',
          tabBarIcon: ({ color, size }) => <TabIcon name="📱" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Workflows"
        component={WorkflowsScreen}
        options={{
          tabBarLabel: 'Workflows',
          tabBarIcon: ({ color, size }) => <TabIcon name="⚡" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Approvals"
        component={ApprovalsScreen}
        options={{
          tabBarLabel: 'Approvals',
          tabBarIcon: ({ color, size }) => <TabIcon name="✓" color={color} size={size} />,
          tabBarBadge: undefined, // Set dynamically
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <TabIcon name="⚙️" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ============================================================
// TAB ICON
// ============================================================

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  const RN = require('react-native');
  return <RN.Text style={{ fontSize: size - 4, color }}>{name}</RN.Text>;
}

// ============================================================
// MAIN NAVIGATOR
// ============================================================

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ presentation: 'modal', headerShown: true, title: 'Notifications' }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

// ============================================================
// APP
// ============================================================

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <NavigationContainer linking={linking}>
                <StatusBar style="auto" />
                <RootNavigator />
              </NavigationContainer>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
      }
