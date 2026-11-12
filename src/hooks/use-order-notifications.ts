import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { ADMIN_TOKEN, API_BASE } from '@/config';

export type Notification = {
  id: number;
  transaction_id: string;
  amount: number;
  content: string | null;
  reference: string | null;
  transaction_time: number;
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
