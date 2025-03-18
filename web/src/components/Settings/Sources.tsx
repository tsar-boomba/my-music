import useSWR from 'swr';
import { apiFetcher } from '../../api';
import { Source } from '../../types/Source';
import { Center, Group, Loader, Paper, Stack, Text } from '@mantine/core';

export const Sources = () => {
	const { data: sources, error } = useSWR<Source[]>('/sources', apiFetcher);

	if (error) {
		return error.toString();
	}

	if (!sources) {
		return (
			<Center>
				<Loader size='xl' />
			</Center>
		);
	}

	return (
		<Stack align='center' p='md'>
			<Group justify='center' align='stretch'>
				{sources.map((source) => (
					<Paper key={source.id} withBorder shadow='sm' p='md' maw={250}>
						<Text fw={700}>{source.path}</Text>
						<Text>Stored in: {source.storageBackendName}</Text>
					</Paper>
				))}
			</Group>
		</Stack>
	);
};
