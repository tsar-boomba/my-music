import { Text, View } from 'react-native';
import { useProgress } from 'react-native-track-player';
import { ThemedView } from '../ThemedView';
import { ThemedText } from '../ThemedText';

const formatSeconds = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60);
	return `${minutes.toFixed(0)}:${(seconds % 60).toFixed(0).padStart(2, '0')}`;
};

export const Progress = () => {
	const { position, duration, buffered } = useProgress(100);

	return (
		<ThemedView>
			<ThemedText>
				{formatSeconds(position)} / {formatSeconds(duration)}
			</ThemedText>
		</ThemedView>
	);
};
