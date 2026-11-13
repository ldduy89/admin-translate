import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  DeviceNotification,
  openNotificationAccess,
  useDeviceNotifications,
} from '@/hooks/use-order-notifications';

export default function DeviceNotificationsScreen() {
  const { items, reload, clear } = useDeviceNotifications();

  const renderItem = ({ item }: { item: DeviceNotification }) => (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.appName}>
          {item.app || item.package}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {new Date(item.time).toLocaleString()}
        </ThemedText>
      </View>
      {item.title ? (
        <ThemedText type="smallBold" selectable>
          {item.title}
        </ThemedText>
      ) : null}
      {item.text ? (
        <ThemedText type="small" selectable>
          {item.text}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {item.package}
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="smallBold">Thông báo trên máy</ThemedText>
          <View style={styles.headerActions}>
            <Pressable onPress={openNotificationAccess} style={styles.headerButton}>
              <ThemedText type="small" themeColor="textSecondary">
                Quyền
              </ThemedText>
            </Pressable>
            <Pressable onPress={clear} style={styles.headerButton}>
              <ThemedText type="small" themeColor="textSecondary">
                Xoá
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <FlatList
          style={styles.list}
          data={items}
          keyExtractor={(item, index) => `${item.key}-${item.time}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onRefresh={reload}
          refreshing={false}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Chưa có thông báo nào. Nếu máy đã nhận thông báo mà vẫn trống, bấm "Quyền" để bật quyền
              đọc thông báo cho app.
            </ThemedText>
          }
        />
      </SafeAreaView>
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
  headerActions: { flexDirection: 'row', gap: Spacing.one },
  headerButton: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  list: { flex: 1 },
  listContent: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  appName: { flexShrink: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.four, paddingHorizontal: Spacing.three },
});
