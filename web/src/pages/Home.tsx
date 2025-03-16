import useSWR from 'swr';
import { apiFetcher } from '../api';
import {
	ActionIcon,
	Affix,
	Box,
	Center,
	Loader,
	Paper,
	Stack,
	UnstyledButton,
} from '@mantine/core';
import { useViewportSize } from '@mantine/hooks';
import { MOBILE_WIDTH } from '../components/Layout';
import { useCallback, useRef } from 'react';
import { TABS_HEIGHT } from '../components/Layout/MobileLayout';
import { useTags } from '../utils/tags';
import { useAuth } from '../utils/useAuth';
import { TbPlus } from 'react-icons/tb';
import { Song } from '../types/Song';
import { openModal } from '@mantine/modals';
import { AddSongModal } from '../components/AddSongModal/AddSongModal';
import { Playback } from '../components/Playback';

export const Home = () => {
	const { data: songs, error } = useSWR<Song[]>('/songs', apiFetcher);
	const { user } = useAuth();
	const { tags, error: tagsError } = useTags();
	const { width } = useViewportSize();
	const ref = useRef<HTMLDivElement>(null);

	const openAddSongs = useCallback(
		() =>
			openModal({
				title: 'Add Songs',
				children: <AddSongModal />,
			}),
		[],
	);

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
		<UnstyledButton
			key={song.id}
			onClick={() =>
				openModal({
					title: `Playing ${song.title}`,
					children: <Playback song={song} />,
				})
			}
		>
			<Paper withBorder shadow='sm' p='sm'>
				{song.title}
			</Paper>
		</UnstyledButton>
	));

	if (width <= MOBILE_WIDTH) {
		return (
			<>
				<Stack mx={12} mt={12} gap={12} style={{ overflow: 'auto' }} ref={ref}>
					{renderedItems}
				</Stack>
				{user.admin && (
					<Affix bottom={TABS_HEIGHT + 12} right={12}>
						<ActionIcon size='xl' radius='xl' onClick={openAddSongs}>
							<TbPlus />
						</ActionIcon>
					</Affix>
				)}
			</>
		);
	}

	return (
		<>
			<Box mx={8} mt={8} pb={36}>
				{renderedItems}
			</Box>
			{user.admin && (
				<Affix bottom={16} right={16}>
					<ActionIcon size='xl' radius='xl' onClick={openAddSongs}>
						<TbPlus />
					</ActionIcon>
				</Affix>
			)}
		</>
	);
};
