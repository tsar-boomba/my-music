import { StyleSheet } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useState } from 'react';
import { downloadsInfo, downloadSources, removeDownloads, useDownloadedSources } from '@/utils/downloads';
import useSWR from 'swr';
import { Source } from '@/types/Source';
import { useFetcher } from '@/hooks/fetcher';
import {  } from 'expo-file-system';

export default function SettingsScreen() {
	const fetcher = useFetcher();
	const { data: allSources } = useSWR<
		(Source & {
			songId: number;
			request: { uri: string };
		})[]
	>('/api/songs/sources', fetcher);
	const downloaded = useDownloadedSources();
	const [downloading, setDownloading] = useState(false);

	return (
		<SafeAreaView>
			<Button
				disabled={!allSources || downloading}
				onPress={async () => {
					if (!allSources) return;
					
					console.log(await downloadsInfo());
					const notDownloaded = allSources.filter((s) => !(s.id in downloaded));
					if (notDownloaded.length === 0) {
						console.log('no sources to download');
						return;
					}

					setDownloading(true);
					try {
						await downloadSources(notDownloaded);
					} catch (e) {
						console.error(e);
					} finally {
						setDownloading(false);
					}
				}}
			>
				<ThemedText>{downloading ? 'downloading...' : 'Download Songs'}</ThemedText>
			</Button>
			<Button onPress={async () => {
				await removeDownloads();
			}}>
				<ThemedText>Remove Downloaded</ThemedText>
			</Button>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	headerImage: {
		color: '#808080',
		bottom: -90,
		left: -35,
		position: 'absolute',
	},
	titleContainer: {
		flexDirection: 'row',
		gap: 8,
	},
});
