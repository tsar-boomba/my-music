import useSWR from 'swr';
import { apiFetcher } from '../api';
import {
	Center,
	Group,
	Loader,
	Paper,
	Stack,
	UnstyledButton,
} from '@mantine/core';
import { useViewportSize } from '@mantine/hooks';
import { MOBILE_WIDTH } from '../components/Layout';
import { useRef } from 'react';
import { useTags } from '../utils/tags';
import { useAuth } from '../utils/useAuth';
import { Song } from '../types/Song';
import { usePlayback } from '../components/Playback';

export const Home = () => {
	const { data: songs, error } = useSWR<Song[]>('/songs', apiFetcher);
	const { user } = useAuth();
	const { tags, error: tagsError } = useTags();
	const { width } = useViewportSize();
	const ref = useRef<HTMLDivElement>(null);
	const { setPlaying } = usePlayback();

	if (error) {
		return error.toString();
	}

	if (tagsError) {
		return tagsError.toString();
	}

	if (!songs || !tags || !user) {
		return (
			<Center>
				<Loader size='xl' />
			</Center>
		);
	}

	const renderedItems = songs.map((song) => (
		<UnstyledButton key={song.id} onClick={() => setPlaying(song)}>
			<Paper withBorder shadow='sm' p='sm'>
				{song.title}
			</Paper>
		</UnstyledButton>
	));

	if (width <= MOBILE_WIDTH) {
		return (
			<Stack p={12} gap={12} ref={ref}>
				{renderedItems}
			</Stack>
		);
	}

	return (
		<Group p={8} style={{ overflow: 'auto' }}>
			{renderedItems}
		</Group>
	);
};
