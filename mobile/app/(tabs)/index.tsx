import {
	StyleSheet,
	SafeAreaView,
	ScrollView,
	TouchableOpacity,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { useSongs } from '@/hooks/maps';
import { useStartSession } from '@/utils/player';
import { useDownloadedSources } from '@/utils/downloads';

export default function HomeScreen() {
	const startSession = useStartSession();
	const { songsArray: songs, error } = useSongs();
	// TODO: indicate that a song is downloaded
	const downloadedSources = useDownloadedSources();

	if (error && !songs)
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
						onPress={() => startSession(songs, i)}
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
