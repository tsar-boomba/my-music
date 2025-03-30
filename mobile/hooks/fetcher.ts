import CookieManager from '@react-native-cookies/cookies';
import { useServer } from './storage';
import { router } from 'expo-router';

export const useFetcher = () => {
	const [baseUrl] = useServer();

	if (!baseUrl) {
		console.log('fetcher with no base')
		setTimeout(() => router.navigate('/login'));
		// @ts-expect-error should be unreachable
		return async <JSON>(url: string): Promise<JSON> => null;
	};

	return async <JSON = unknown>(url: string): Promise<JSON> => {
		const cookies = await CookieManager.get(baseUrl);
		const cookiesHeader = Object.values(cookies)
			.map((c) => `${c.name}=${c.value}`)
			.join(';');
		const res = await fetch(`${baseUrl}${url}`, {
			credentials: 'include',
		});
		if (res.ok) {
			return res.json();
		} else {
			throw new Error(`Bad response ${res.status} for ${url}`);
		}
	};
};
