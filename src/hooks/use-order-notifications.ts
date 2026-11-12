import { useEffect, useState } from 'react';
import { Linking, NativeEventEmitter, NativeModules, Platform } from 'react-native';

export type OrderNotification = {
  title: string;
  text: string;
  time: string;
};

const { NotificationBridge } = NativeModules;

export function useOrderNotifications(): OrderNotification[] {
  const [items, setItems] = useState<OrderNotification[]>([]);

  useEffect(() => {
    if (!NotificationBridge) return;
    const emitter = new NativeEventEmitter(NotificationBridge);
    const sub = emitter.addListener('OrderNotification', (n: { title: string; text: string }) => {
      setItems((prev) => [{ ...n, time: new Date().toLocaleTimeString() }, ...prev]);
    });
    return () => sub.remove();
  }, []);

  return items;
}

export function openNotificationAccess() {
  if (Platform.OS !== 'android') return;
  Linking.sendIntent('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS');
}
