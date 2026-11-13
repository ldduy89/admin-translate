// Chỉ dùng khi phát triển. Được nạp từ _layout.tsx trong nhánh __DEV__.
import Reactotron from 'reactotron-react-native';


if (__DEV__) {
  Reactotron.configure({ name: 'admin-translate' })
    .useReactNative({
      networking: { ignoreUrls: /symbolicate/ },
      errors: true,
    })
    .connect();
  Reactotron.clear();
}

export default Reactotron;
