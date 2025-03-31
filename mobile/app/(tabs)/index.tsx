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
import TrackPlayer, {
	AddTrack,
	RepeatMode,
	TrackType,
} from 'react-native-track-player';
import useSWR from 'swr';
import { useFetcher } from '@/hooks/fetcher';
import { Source } from '@/types/Source';
import { useServer } from '@/hooks/storage';
import { Album } from '@/types/Album';
import CookieManager from '@react-native-cookies/cookies';
import { useStartSession } from '@/utils/player';



export default function HomeScreen() {
	const startSession = useStartSession();
	const { songsArray: songs, error } = useSongs();

	if (error)
		return (
			<SafeAreaView>
				<ThemedText>{error.toString()}</ThemedText>
			</SafeAreaView>
		);
	if (!songs || !startSession) return null;

	return (
		<SafeAreaView>
			<ScrollView>
				{songs.map((s, i) => (
					<TouchableOpacity
						key={s.id}
						style={styles.song}
						onPress={() => {
							startSession(songs, i)
						}}
					>
						<ThemedText>{s.title}</ThemedText>
					</TouchableOpacity>
				))}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	song: {
		padding: 12,
		borderWidth: 1,
	},
});
