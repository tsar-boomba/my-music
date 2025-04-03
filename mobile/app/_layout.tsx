import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useServer } from '@/hooks/storage';
import { SWRConfig } from 'swr';
import { AppState, AppStateStatus } from 'react-native';
import { setupPlayer } from '@/utils/player';
import CookieManager from '@react-native-cookies/cookies';
import { storage } from '@/utils/storage';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const [loaded] = useFonts({
		SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
	});
	const [server] = useServer();
	const playerReady = useSetupPlayer();
	// Pay the cost to get the
	const [fallback, setFallback] = useState<Record<string, any>>({});

	useEffect(() => {
		storage
			.getMapAsync<Record<string, any>>('swr-fallback')
			.then((storedFallback) => {
				setFallback(storedFallback ?? {});
			});
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
					fallback,
					onSuccess: (data, key) => {
						// Don't need rerender, so don't use set function
						fallback[key] = data;
						storage.setMapAsync(`swr-fallback`, fallback);
					},
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

function useSetupPlayer() {
	const [playerReady, setPlayerReady] = useState<boolean>(false);

	useEffect(() => {
		let unmounted = false;
		(async () => {
			await setupPlayer();
			if (unmounted) return;
			setPlayerReady(true);
			if (unmounted) return;
		})();
		return () => {
			unmounted = true;
		};
	}, []);
	return playerReady;
}
