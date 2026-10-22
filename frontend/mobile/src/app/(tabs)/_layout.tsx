import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/navigation/tab-bar';

export const unstable_settings = { anchor: 'index' };

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="categories" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
