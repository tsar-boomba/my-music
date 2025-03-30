import { Button } from '@/components/Button';
import { useAuthToken, useServer } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/useThemeColor';
import CookieManager from '@react-native-cookies/cookies';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [storedServer, setStoredServer] = useServer();
	const [serverUrl, setServerUrl] = useState(
		storedServer ? storedServer : process.env.NODE_ENV === 'development'
			? 'http://localhost:8013'
			: '',
	);
	const [loading, setLoading] = useState(false);
	const color = useThemeColor({ light: undefined, dark: undefined }, 'text');

	const login = async () => {
		console.log('logginging');
		if (!username || !password || !serverUrl) return;
		setLoading(true);
		try {
			const res = await fetch(`${serverUrl}/api/login`, {
				method: 'POST',
				body: JSON.stringify({
					username,
					password,
				}),
				headers: {
					'content-type': 'application/json',
				},
			});

			if (!res.ok) return;
			const setCookieValue = res.headers.get('set-cookie');

			if (!setCookieValue) return;
			const cookieSet = await CookieManager.setFromResponse(
				serverUrl,
				setCookieValue,
			);

			console.log(await CookieManager.get(serverUrl));
			if (cookieSet) {
				setStoredServer(serverUrl);
				router.navigate('/(tabs)');
			}
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	return (
		<SafeAreaView>
			<TextInput
				style={[{ color }, styles.input]}
				value={username}
				onChangeText={setUsername}
				autoCapitalize='none'
				placeholder='Username'
			/>
			<TextInput
				style={[{ color }, styles.input]}
				value={password}
				onChangeText={setPassword}
				autoCapitalize='none'
				placeholder='Password'
			/>
			<TextInput
				style={[{ color }, styles.input]}
				value={serverUrl}
				onChangeText={setServerUrl}
				placeholder='Server URL ex. https://music.dev'
			/>
			<Button disabled={loading} onPress={login}>
				<Text>Login</Text>
			</Button>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	input: {
		height: 40,
		margin: 12,
		borderWidth: 1,
		padding: 10,
		borderRadius: 8,
	},
});
