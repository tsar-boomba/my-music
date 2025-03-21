import useSWR from 'swr';
import { apiFetcher, apiUrl } from '../api';
import {
	ActionIcon,
	Center,
	Group,
	Loader,
	Menu,
	Paper,
	Stack,
	Text,
	UnstyledButton,
} from '@mantine/core';
import { useViewportSize } from '@mantine/hooks';
import { MOBILE_WIDTH } from '../components/Layout';
import { useRef } from 'react';
import { useTags } from '../utils/tags';
import { useAuth } from '../utils/useAuth';
import { Song } from '../types/Song';
import { usePlayback } from '../components/Playback';
import { modals } from '@mantine/modals';
import { TbDots, TbTrash } from 'react-icons/tb';

export const Home = () => {
	const { data: songs, error, mutate } = useSWR<Song[]>('/songs', apiFetcher);
	const { user } = useAuth();
	const { tags, error: tagsError } = useTags();
	const { width } = useViewportSize();
	const ref = useRef<HTMLDivElement>(null);
	const { startSession } = usePlayback();

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

	const createDeleteModal = (song: Song) => () =>
		modals.openConfirmModal({
			title: `Delete ${song.title}`,
			centered: true,
			children: (
				<Text size='sm'>Are you sure you want to delete this song?</Text>
			),
			labels: { confirm: 'Delete', cancel: 'Cancel' },
			confirmProps: { color: 'red' },
			onCancel: () => {},
			onConfirm: async () => {
				try {
					const res = await fetch(apiUrl(`/songs/${song.id}`), {
						method: 'DELETE',
						credentials: 'include',
					});
					if (res.ok) {
						await mutate();
						startSession({ songs: [], start: 0 });
					}
				} catch (e) {
					console.error(e);
				}
			},
		});

	const renderedItems = songs.map((song, i) => (
		<UnstyledButton onClick={() => startSession({ songs, start: i })}>
			<Paper withBorder shadow='sm' p='sm'>
				<Group wrap='nowrap' justify='space-between'>
					<Text>{song.title}</Text>
					{user.admin && (
						<Menu key={song.id} shadow='md'>
							<Menu.Target>
								<ActionIcon size='sm' variant='subtle' onClick={(e) => e.stopPropagation()}>
									<TbDots />
								</ActionIcon>
							</Menu.Target>
							<Menu.Dropdown onClick={(e) => e.stopPropagation()}>
								<Menu.Item
									c='red'
									leftSection={<TbTrash />}
									onClick={createDeleteModal(song)}
								>
									Delete
								</Menu.Item>
							</Menu.Dropdown>
						</Menu>
					)}
				</Group>
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
