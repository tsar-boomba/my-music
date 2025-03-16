import useSWR from 'swr';
import { apiFetcher } from '../../api';
import { Source } from '../../types/Source';
import { Center, Loader, Paper, Stack, Text } from '@mantine/core';

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
		<Stack align='center'>
			<Stack>
				{sources.map((source) => (
					<Paper key={source.id} withBorder shadow='sm' p='md'>
						<Text fw={700}>{source.path}</Text>
					</Paper>
				))}
			</Stack>
		</Stack>
	);
};
