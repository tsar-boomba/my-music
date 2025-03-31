import { Tabs, TabSlot, TabList, TabTrigger } from 'expo-router/ui';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground, {
	useBottomTabOverflow,
} from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Playback } from '@/components/Playback/Playback';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
	const colorScheme = useColorScheme();
	const { bottom } = useSafeAreaInsets();

	return (
		<Tabs>
			<ThemedView style={styles.container}>
				<TabSlot />
				<Playback />
			</ThemedView>
			<TabList style={[{ paddingBottom: bottom }, styles.list]}>
				<TabTrigger name='index' href='/'>
					<ThemedText>Home</ThemedText>
				</TabTrigger>
				<TabTrigger name='settings' href='/settings'>
					<ThemedText>Settings</ThemedText>
				</TabTrigger>
			</TabList>
		</Tabs>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	list: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 16,
	},
});
