import { Text, View } from 'react-native';
import { useProgress } from 'react-native-track-player';
import { ThemedView } from '../ThemedView';

export const Progress = () => {
	const progress = useProgress(250);

	return (
		<ThemedView>
			<Text>
				{progress.position.toFixed(2)} / {progress.duration.toFixed(2)}
			</Text>
		</ThemedView>
	);
};
