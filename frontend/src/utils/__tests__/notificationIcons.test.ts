import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';
import { ICONS } from '@/components/NotificationItem';

test.each(Object.entries(ICONS))('%s icon exists in Ionicons', (_type, name) => {
  expect(Object.keys(glyphs)).toContain(name);
});
