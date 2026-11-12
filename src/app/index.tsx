import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { Notification, openNotificationAccess, useNotificationList } from '@/hooks/use-order-notifications';
import { useTheme } from '@/hooks/use-theme';

const PRIMARY = '#208AEF';

const LUOT_OPTIONS = [
  { label: '20.000đ', value: 20000 },
  { label: '100.000đ', value: 100000 },
  { label: '200.000đ', value: 200000 },
  { label: '500.000đ', value: 500000 },
];

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

const money = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

export default function TranslateScreen() {
  const theme = useTheme();
  const [id, setId] = useState('');
  const [luot, setLuot] = useState<number>(LUOT_OPTIONS[0].value);
  const { items, loading, refreshing, error, refresh, loadMore } = useNotificationList();

  const handleThem = () => {
    // TODO: xử lý thêm dữ liệu (id, luot)
    console.log('Thêm:', { id, luot });
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold">+{money(item.amount)}</ThemedText>
        <ThemedText type="small" style={{ color: statusColor(item) }}>
          {statusText(item)}
        </ThemedText>
      </View>
      <ThemedText type="small">ND: {item.content ?? '(trống)'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Mã GD: {item.reference ?? '-'} · {new Date(item.transaction_time).toLocaleString()}
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
        <ThemedText type="subtitle" style={styles.title}>
          Admin translate
        </ThemedText>

        <View style={styles.form}>
          <ThemedText type="smallBold">ID</ThemedText>
          <TextInput
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
            ]}
            placeholder="Nhập ID"
            placeholderTextColor={theme.textSecondary}
            value={id}
            onChangeText={setId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ThemedText type="smallBold">Lượt</ThemedText>
          <View
            style={[
              styles.pickerWrapper,
              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
            ]}>
            <Picker
              selectedValue={luot}
              onValueChange={(value) => setLuot(Number(value))}
              style={{ color: theme.text }}
              dropdownIconColor={theme.text}>
              {LUOT_OPTIONS.map((opt) => (
                <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
              ))}
            </Picker>
          </View>

          <Pressable onPress={handleThem} style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText style={styles.buttonText}>Thêm</ThemedText>
          </Pressable>

          <Pressable
            onPress={openNotificationAccess}
            style={({ pressed }) => [styles.button, styles.buttonSecondary, { opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText style={styles.buttonText}>Cấp quyền đọc thông báo</ThemedText>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold">Biến động số dư</ThemedText>
          {error ? (
            <Pressable onPress={refresh}>
              <ThemedText type="small" style={{ color: '#c62828' }}>
                Tải lại ({error})
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

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
              {refreshing ? 'Đang tải...' : 'Chưa có thông báo'}
            </ThemedText>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset,
  },
  title: { textAlign: 'center', marginTop: Spacing.three },
  form: { gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  pickerWrapper: { borderWidth: 1, borderRadius: Spacing.two, overflow: 'hidden' },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  buttonSecondary: { backgroundColor: '#546e7a' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.two, paddingBottom: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { paddingVertical: Spacing.three },
  empty: { textAlign: 'center', marginTop: Spacing.four },
});
