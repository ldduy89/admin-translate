import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { ADMIN_TOKEN, API_BASE } from '@/config';

export type Notification = {
  id: number;
  raw_content: string | null;
  transaction_id?: string;
  amount?: number | null;
  content?: string | null;
  reference?: string | null;
  transaction_time?: number;
  claimed: boolean;
  processed: boolean;
  attempts: number;
  last_error: string | null;
  created_at: number;
};

type Page = { items: Notification[]; next_cursor: number | null };

const PAGE_SIZE = 10;
const { NotificationBridge } = NativeModules;

async function fetchPage(before?: number): Promise<Page> {
  const url = `${API_BASE}/admin/notifications?limit=${PAGE_SIZE}${before ? `&before=${before}` : ''}`;
  const res = await fetch(url, { headers: { 'x-admin-token': ADMIN_TOKEN } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Danh sách thông báo từ server, tải 10 cái mỗi lần khi cuộn tới cuối
export function useNotificationList() {
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    setError(null);
    try {
      const page = await fetchPage();
      setItems(page.items);
      setCursor(page.next_cursor);
      setHasMore(page.next_cursor !== null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore || cursor === null) return;
    busy.current = true;
    setLoading(true);
    try {
      const page = await fetchPage(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
      setHasMore(page.next_cursor !== null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor, hasMore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Có thông báo mới từ điện thoại: tải lại trang đầu sau một chút (server cần thời gian lưu)
  useEffect(() => {
    if (!NotificationBridge) return;
    const emitter = new NativeEventEmitter(NotificationBridge);
    const sub = emitter.addListener('OrderNotification', () => {
      setTimeout(refresh, 1500);
    });
    return () => sub.remove();
  }, [refresh]);

  return { items, loading, refreshing, error, hasMore, refresh, loadMore };
}

export function openNotificationAccess() {
  if (Platform.OS !== 'android') return;
  Linking.sendIntent('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS');
}

// Gửi tay một thông báo biến động số dư lên server (dán nội dung từ tin nhắn ngân hàng)
export async function addNotification(text: string): Promise<{ stored: boolean; duplicate?: boolean; reason?: string }> {
  const res = await fetch(`${API_BASE}/admin/notifications`, {
    method: 'POST',
    headers: { 'x-admin-token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- Thông báo trên máy (mọi app) ----------
export type DeviceNotification = {
  key: string;
  package: string;
  app: string;
  title: string;
  text: string;
  time: number;
};

const MAX_DEVICE_ITEMS = 100;

export function useDeviceNotifications() {
  const [items, setItems] = useState<DeviceNotification[]>([]);

  // Đọc danh sách đã lưu phía native (có cả thông báo nhận lúc app đóng)
  const load = useCallback(async () => {
    if (!NotificationBridge?.getRecent) return;
    try {
      const json: string = await NotificationBridge.getRecent();
      setItems(JSON.parse(json));
    } catch {
      // bỏ qua, giữ danh sách hiện tại
    }
  }, []);

  // Mở tab hoặc quay lại app thì tải lại
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  // Thông báo mới khi app đang mở: thêm lên đầu
  useEffect(() => {
    if (!NotificationBridge) return;
    const emitter = new NativeEventEmitter(NotificationBridge);
    const sub = emitter.addListener('DeviceNotification', (e: { json: string }) => {
      try {
        const item: DeviceNotification = JSON.parse(e.json);
        setItems((prev) => [item, ...prev].slice(0, MAX_DEVICE_ITEMS));
      } catch {
        // bỏ qua thông báo lỗi định dạng
      }
    });
    return () => sub.remove();
  }, []);

  const clear = useCallback(async () => {
    setItems([]);
    try {
      await NotificationBridge?.clearRecent?.();
    } catch {
      // bỏ qua
    }
  }, []);

  return { items, reload: load, clear };
}
