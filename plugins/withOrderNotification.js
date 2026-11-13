const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const listenerKt = (pkg, targets) => `package ${pkg}

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

class OrderNotificationListenerService : NotificationListenerService() {
    private val targetPackages = setOf(${targets.map((t) => `"${t}"`).join(', ')})

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val extras = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = (extras.getCharSequence("android.bigText")
            ?: extras.getCharSequence("android.text"))?.toString() ?: ""

        // Mọi thông báo trên máy: lưu lại và báo cho giao diện (tab "Thông báo máy")
        val item = JSONObject()
            .put("key", sbn.key)
            .put("package", sbn.packageName)
            .put("app", appLabel(sbn.packageName))
            .put("title", title)
            .put("text", text)
            .put("time", sbn.postTime)
        DeviceNotificationStore.add(applicationContext, item)
        NotificationBridgeModule.instance?.emitDevice(item.toString())

        // Chỉ thông báo của app ngân hàng mới gửi lên server
        if (sbn.packageName !in targetPackages) return
        NotificationBridgeModule.instance?.emit(title, text)
        PaymentSync.forward(title, text)
    }

    private fun appLabel(pkg: String): String = try {
        val pm = applicationContext.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (e: Exception) {
        pkg
    }
}
`;

const storeKt = (pkg) => `package ${pkg}

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

// Lưu 100 thông báo gần nhất của máy để tab "Thông báo máy" vẫn thấy khi app đóng
object DeviceNotificationStore {
    private const val PREFS = "device_notifications"
    private const val KEY = "items"
    private const val MAX = 100

    @Synchronized
    fun add(ctx: Context, item: JSONObject) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val old = try {
            JSONArray(prefs.getString(KEY, "[]"))
        } catch (e: Exception) {
            JSONArray()
        }
        val out = JSONArray()
        out.put(item)
        var i = 0
        while (i < old.length() && out.length() < MAX) {
            out.put(old.get(i))
            i++
        }
        prefs.edit().putString(KEY, out.toString()).apply()
    }

    @Synchronized
    fun read(ctx: Context): String =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"

    @Synchronized
    fun clear(ctx: Context) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
    }
}
`;

const bridgeKt = (pkg) => `package ${pkg}

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class NotificationBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        instance = this
    }

    override fun getName(): String = "NotificationBridge"

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun getRecent(promise: Promise) {
        try {
            promise.resolve(DeviceNotificationStore.read(reactContext.applicationContext))
        } catch (e: Exception) {
            promise.reject("E_READ", e)
        }
    }

    @ReactMethod
    fun clearRecent(promise: Promise) {
        try {
            DeviceNotificationStore.clear(reactContext.applicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_CLEAR", e)
        }
    }

    // Thông báo của app ngân hàng: giao diện tải lại danh sách từ server
    fun emit(title: String, text: String) {
        // Khi UI đã đóng thì không có ai nhận sự kiện, bỏ qua
        if (!reactContext.hasActiveReactInstance()) return
        val params = Arguments.createMap().apply {
            putString("title", title)
            putString("text", text)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("OrderNotification", params)
    }

    // Mọi thông báo trên máy: giao diện thêm vào đầu danh sách
    fun emitDevice(json: String) {
        if (!reactContext.hasActiveReactInstance()) return
        val params = Arguments.createMap().apply {
            putString("json", json)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("DeviceNotification", params)
    }

    companion object {
        var instance: NotificationBridgeModule? = null
    }
}
`;

const packageKt = (pkg) => `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class NotificationPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(NotificationBridgeModule(ctx))

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

// PaymentSync.kt là file mẫu: thay các placeholder bằng giá trị trong app.json
const paymentSyncKt = (opts) =>
  fs
    .readFileSync(path.join(__dirname, 'native', 'PaymentSync.kt'), 'utf8')
    .replace('__API_BASE__', opts.apiBase)
    .replace('__ADMIN_TOKEN__', opts.adminToken);

module.exports = (config, opts = {}) => {
  const {
    targetPackages = [],
    apiBase = 'https://ddtechtrans.up.railway.app',
    adminToken = '01756089',
  } = opts;

  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    // Để lấy tên hiển thị của app gửi thông báo (Android 11+ che các app khác)
    const manifest = c.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    if (!manifest['uses-permission'].some((p) => p.$['android:name'] === 'android.permission.QUERY_ALL_PACKAGES')) {
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.QUERY_ALL_PACKAGES' } });
    }
    app.service = app.service || [];
    app.service.push({
      $: {
        'android:name': '.OrderNotificationListenerService',
        'android:label': 'Order notification listener',
        'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        'android:exported': 'true',
      },
      'intent-filter': [
        { action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }] },
      ],
    });
    return c;
  });

  config = withDangerousMod(config, [
    'android',
    (c) => {
      const pkg = c.android.package;
      const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'OrderNotificationListenerService.kt'), listenerKt(pkg, targetPackages));
      fs.writeFileSync(path.join(dir, 'NotificationBridgeModule.kt'), bridgeKt(pkg));
      fs.writeFileSync(path.join(dir, 'DeviceNotificationStore.kt'), storeKt(pkg));
      fs.writeFileSync(path.join(dir, 'NotificationPackage.kt'), packageKt(pkg));
      fs.writeFileSync(path.join(dir, 'PaymentSync.kt'), paymentSyncKt({ apiBase, adminToken }));
      return c;
    },
  ]);

  config = withMainApplication(config, (c) => {
    c.modResults.contents = c.modResults.contents.replace(
      'PackageList(this).packages.apply {',
      'PackageList(this).packages.apply {\n              add(NotificationPackage())'
    );
    return c;
  });

  return config;
};
