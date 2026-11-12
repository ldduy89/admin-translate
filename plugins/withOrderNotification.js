const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const listenerKt = (pkg, targets) => `package ${pkg}

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class OrderNotificationListenerService : NotificationListenerService() {
    private val targetPackages = setOf(${targets.map((t) => `"${t}"`).join(', ')})

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in targetPackages) return
        val extras = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = (extras.getCharSequence("android.bigText")
            ?: extras.getCharSequence("android.text"))?.toString() ?: ""
        NotificationBridgeModule.instance?.emit(title, text)
        PaymentSync.forward(title, text)
    }
}
`;

const bridgeKt = (pkg) => `package ${pkg}

import com.facebook.react.bridge.Arguments
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
    apiBase = 'http://192.168.1.8:3000',
    adminToken = 'REPLACE_WITH_ADMIN_TOKEN',
  } = opts;

  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
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
