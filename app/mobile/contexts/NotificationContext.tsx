/**
 * VYENFITA Mobile Notification Context
 * 
 * Handles push notifications.
 * 
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '../api/client';

interface NotificationContextValue {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  unreadCount: number;
  setUnreadCount: (n: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        setExpoPushToken(token);
        await api.registerPushToken(token, Platform.OS as 'ios' | 'android');
      }
    })();

    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      setNotification(notif);
      setUnreadCount((c) => c + 1);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      // Navigate based on response.notification.request.content.data
      console.log('Notification tapped:', response);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{ expoPushToken, notification, unreadCount, setUnreadCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#667eea',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
