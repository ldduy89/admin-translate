import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Notification, addNotification, useNotificationList } from '@/hooks/use-order-notifications';

const statusText = (n: Notification) => {
  if (n.processed) return 'Đã xử lý';
  if (n.claimed && n.last_error) return 'Cần kiểm tra';
  if (n.claimed) return 'Đang xử lý';
  return 'Chờ xử lý';
};

const statusColor = (n: Notification) => {
  if (n.processed) return '#2e7d32';
  if (n.claimed && n.last_error) return '#c62828';
  if (n.claimed) return '#1976d2';
  return '#ef6c00';
};

export default function BienDongScreen() {
  const theme = useTheme();
  const { items, loading, refreshing, error, refresh, loadMore } = useNotificationList();

  const [modalOpen, setModalOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openModal = () => {
    setText('');
    setFormError(null);
    setModalOpen(true);
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setFormError(null);
    try {
      const r = await addNotification(value);
      if (!r.stored) {
        setFormError('Không phải thông báo biến động số dư, kiểm tra lại nội dung');
        return;
      }
      setModalOpen(false);
      setTimeout(refresh, 1000); // server cần thời gian lưu và xử lý
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="small" themeColor="textSecondary">
          {new Date(item.created_at * 1000).toLocaleString()}
        </ThemedText>
        <ThemedText type="small" style={{ color: statusColor(item) }}>
          {statusText(item)}
        </ThemedText>
      </View>
      <ThemedText type="small" selectable>
        {item.raw_content ?? '(trống)'}
      </ThemedText>
      {item.last_error ? (
        <ThemedText type="small" style={{ color: '#c62828' }}>
          Lỗi: {item.last_error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="smallBold">Biến động số dư</ThemedText>
          <Pressable onPress={openModal} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.addButtonText}>
              + Thêm thông báo
            </ThemedText>
          </Pressable>
        </View>

        {error ? (
          <Pressable onPress={refresh} style={styles.errorBar}>
            <ThemedText type="small" style={{ color: '#c62828' }}>
              Tải lại ({error})
            </ThemedText>
          </Pressable>
        ) : null}

        <FlatList
          style={styles.list}
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          onRefresh={refresh}
          refreshing={refreshing}
          ListFooterComponent={loading ? <ActivityIndicator style={styles.footer} /> : null}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {refreshing ? 'Đang tải...' : 'Chưa có biến động số dư'}
            </ThemedText>
          }
        />
      </SafeAreaView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalOpen(false)} />
          <ThemedView style={styles.modal}>
            <ThemedText type="smallBold">Nhập thông báo</ThemedText>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Dán nội dung thông báo biến động số dư"
              placeholderTextColor={theme.textSecondary}
              multiline
              autoFocus
              textAlignVertical="top"
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            {formError ? (
              <ThemedText type="small" style={{ color: '#c62828' }}>
                {formError}
              </ThemedText>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalOpen(false)} style={styles.cancelButton}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Huỷ
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!text.trim() || sending}
                style={[styles.addButton, (!text.trim() || sending) && styles.disabled]}>
                {sending ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText type="smallBold" style={styles.addButtonText}>
                    Gửi
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%', paddingBottom: BottomTabInset },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  addButton: {
    backgroundColor: '#1976d2',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  addButtonText: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  errorBar: { paddingVertical: Spacing.two, alignItems: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { paddingVertical: Spacing.three },
  empty: { textAlign: 'center', marginTop: Spacing.four },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  modal: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  input: {
    minHeight: 140,
    maxHeight: 280,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 14,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.three },
  cancelButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
});
