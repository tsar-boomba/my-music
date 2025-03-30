import {
	StyleSheet,
	SafeAreaView,
	ScrollView,
	TouchableOpacity,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSongs } from '@/hooks/maps';
import { useEffect } from 'react';
import TrackPlayer, { AddTrack, RepeatMode } from 'react-native-track-player';
import useSWR from 'swr';
import { useFetcher } from '@/hooks/fetcher';
import { Source } from '@/types/Source';
import { useServer } from '@/hooks/storage';
import { Playback } from '@/components/Playback/Playback';
import { Album } from '@/types/Album';
import CookieManager from '@react-native-cookies/cookies';

const uriForSource = (
	baseUrl: string,
	cookiesHeader: string,
	source: { request: { uri: string } },
): { uri: string; headers: Record<string, string> } => {
	let uri = source.request.uri;
	const headers: Record<string, string> = {};
	if (uri.startsWith('/')) {
		uri = `${baseUrl}${uri}`;
		headers['cookie'] = cookiesHeader;
	}
	return { uri, headers };
};

export default function HomeScreen() {
	const fetcher = useFetcher();
	const [baseUrl] = useServer();
	const { data: allSources } = useSWR<
		(Source & {
			songId: number;
			request: { uri: string };
		})[]
	>('/api/songs/sources', fetcher);
	const { data: allAlbums } = useSWR<
		(Album & {
			songId: number;
			request: { uri: string };
		})[]
	>('/api/albums/sources', fetcher);
	const { songsArray: songs, error } = useSongs();

	useEffect(() => {
		setTimeout(async () => {
			if (!songs || !allSources || !allAlbums || !baseUrl) return;
			const cookies = await CookieManager.get(baseUrl);
			const cookiesHeader = Object.values(cookies)
				.map((c) => `${c.name}=${c.value}`)
				.join(';');
			await TrackPlayer.reset();
			await TrackPlayer.setRepeatMode(RepeatMode.Queue);
			const tracks = songs
				.map((s) => {
					const source = allSources.find((src) => src.songId === s.id);
					if (!source) return undefined;
					const album = allAlbums.find((a) => s.tags.includes(a.title));
					const { uri, headers } = uriForSource(baseUrl, cookiesHeader, source);
					const albumUri = album
						? uriForSource(baseUrl, cookiesHeader, album)
						: undefined;

					return {
						url: uri,
						title: s.title,
						headers,
						artwork: albumUri?.uri,
					} satisfies AddTrack;
				})
				.filter((t) => t !== undefined);
			await TrackPlayer.setQueue(tracks);
		});
	}, [songs, allSources, baseUrl]);

	if (error)
		return (
			<SafeAreaView>
				<ThemedText>{error.toString()}</ThemedText>
			</SafeAreaView>
		);
	if (!songs || !allSources) return null;

	const filteredSongs = songs.filter(
		(s) => !!allSources.find((src) => src.songId === s.id),
	);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView>
				<ScrollView>
					{filteredSongs.map((s, i) => (
						<TouchableOpacity
							key={s.id}
							onPress={async () => {
								await TrackPlayer.skip(i);
								await TrackPlayer.play();
							}}
						>
							<ThemedText>{s.title}</ThemedText>
						</TouchableOpacity>
					))}
				</ScrollView>
				<Playback />
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
