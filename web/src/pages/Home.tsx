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
import { useSongs, useTags } from '../utils/maps';
import { useAuth } from '../utils/useAuth';
import { Song } from '../types/Song';
import { usePlayback } from '../components/Playback';
import { modals } from '@mantine/modals';
import { TbDots, TbTrash } from 'react-icons/tb';
import { openSongDetailModal } from '../components/SongDetailModal/SongDetailModal';
import useSWR from 'swr';
import { AlbumSource } from '../components/Playback/Playback';

export const Home = () => {
	const { songsArray: songs, error, mutate } = useSongs();
	const { user } = useAuth();
	const { tags, error: tagsError } = useTags();
	const { data: albums, error: albumsError } = useSWR<AlbumSource[]>(
		'/albums/sources',
		apiFetcher,
	);
	const { width } = useViewportSize();
	const ref = useRef<HTMLDivElement>(null);
	const { startSession } = usePlayback();

	if (error) {
		return error.toString();
	}

	if (tagsError) {
		return tagsError.toString();
	}

	if (albumsError) {
		return albumsError.toString();
	}

	if (!songs || !tags || !user || !albums) {
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

	const renderedItems = songs.map((song, i) => {
		const album = albums?.filter((a) => song.tags.includes(a.title))?.[0];
		return (
			<UnstyledButton
				key={song.id}
				onClick={() => startSession({ songs, start: i })}
			>
				<Paper withBorder shadow='sm' p='sm'>
					<Group wrap='nowrap' justify='space-between'>
						<Text>{song.title}</Text>
						{user.admin && (
							<Menu shadow='md'>
								<Menu.Target>
									<ActionIcon
										size='sm'
										variant='subtle'
										onClick={(e) => e.stopPropagation()}
									>
										<TbDots />
									</ActionIcon>
								</Menu.Target>
								<Menu.Dropdown onClick={(e) => e.stopPropagation()}>
									<Menu.Item
										leftSection={<TbDots />}
										onClick={() => openSongDetailModal({ song, album })}
									>
										Details
									</Menu.Item>
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
		);
	});

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
