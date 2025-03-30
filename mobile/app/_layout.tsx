import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthToken, useServer } from '@/hooks/storage';
import { SWRConfig } from 'swr';
import { AppState, AppStateStatus } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import { registerPlayer } from '@/utils/player';
import CookieManager from '@react-native-cookies/cookies';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
let playerReadyPromise = registerPlayer();

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const [loaded] = useFonts({
		SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
	});
	const [playerReady, setPlayerReady] = useState(false);
	const [server] = useServer();

	useEffect(() => {
		playerReadyPromise.then(() => setPlayerReady(true));
	}, []);

	useEffect(() => {
		if (playerReady && loaded) {
			SplashScreen.hideAsync();
			if (!server) {
				router.navigate('/login');
				return;
			}

			CookieManager.get(server).then((cookies) => {
				if (!cookies.auth) {
					router.navigate('/login');
				}
			});
		}
	}, [playerReady, loaded]);

	if (!loaded) {
		return null;
	}

	return (
		<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
			<SWRConfig
				value={{
					provider: () => new Map(),
					isVisible: () => {
						return true;
					},
					initFocus(callback) {
						let appState = AppState.currentState;

						const onAppStateChange = (nextAppState: AppStateStatus) => {
							/* If it's resuming from background or inactive mode to active one */
							if (
								appState.match(/inactive|background/) &&
								nextAppState === 'active'
							) {
								callback();
							}
							appState = nextAppState;
						};

						// Subscribe to the app state change events
						const subscription = AppState.addEventListener(
							'change',
							onAppStateChange,
						);

						return () => {
							subscription.remove();
						};
					},
				}}
			>
				<Stack>
					<Stack.Screen name='login' options={{ headerShown: false }} />
					<Stack.Screen name='(tabs)' options={{ headerShown: false }} />
					<Stack.Screen name='+not-found' />
				</Stack>
				<StatusBar style='auto' />
			</SWRConfig>
		</ThemeProvider>
	);
}
