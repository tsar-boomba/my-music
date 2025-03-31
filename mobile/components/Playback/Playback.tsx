import { useEffect, useState } from 'react';
import { ThemedView } from '../ThemedView';
import TrackPlayer, {
	Event,
	RepeatMode,
	useActiveTrack,
	useIsPlaying,
	useTrackPlayerEvents,
} from 'react-native-track-player';
import { ThemedText } from '../ThemedText';
import { Button } from '../Button';
import { StyleSheet } from 'react-native';
import { Progress } from './Progress';

export const Playback = () => {
	const { playing, bufferingDuringPlay } = useIsPlaying();
	const [repeatMode, setRepeatMode] = useState(RepeatMode.Queue);
	const track = useActiveTrack();

	useEffect(
		() => () => {
			TrackPlayer.stop();
		},
		[],
	);

	return (
		<ThemedView style={styles.container}>
			<ThemedText>
				{track ? (track.title ?? 'no title') : 'no track'}
			</ThemedText>
			<Progress />
			<ThemedView style={styles.controls}>
				<Button
					onPress={async () => {
						TrackPlayer.skipToPrevious();
					}}
				>
					<ThemedText>Prev</ThemedText>
				</Button>
				<Button
					onPress={async () => {
						if (track) await TrackPlayer.updateNowPlayingMetadata(track);
						if (playing || bufferingDuringPlay) {
							TrackPlayer.pause();
						} else {
							console.log('queue', await TrackPlayer.getQueue());
							TrackPlayer.play();
						}
					}}
				>
					<ThemedText>
						{bufferingDuringPlay ? '...' : playing ? 'Pause' : 'Play'}
					</ThemedText>
				</Button>
				<Button
					onPress={async () => {
						TrackPlayer.skipToNext();
					}}
				>
					<ThemedText>Next</ThemedText>
				</Button>
				<Button
					onPress={async () => {
						const nextRepeatMode =
							repeatMode === RepeatMode.Queue
								? RepeatMode.Track
								: RepeatMode.Queue;
						TrackPlayer.setRepeatMode(nextRepeatMode);
						setRepeatMode(nextRepeatMode);
					}}
				>
					<ThemedText>
						{repeatMode === RepeatMode.Queue ? 'Loop' : 'No Loop'}
					</ThemedText>
				</Button>
			</ThemedView>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	container: {
		position: 'sticky',
		alignItems: 'center',
		padding: 8,
		bottom: 0,
		left: 0,
		right: 0,
	},
	controls: {
		flexDirection: 'row',
	},
});
