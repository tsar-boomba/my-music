import { Group, Loader, Stack, Text } from '@mantine/core';
import { SongWTags, useTags } from '../../utils/maps';
import { AlbumSource } from '../Playback/Playback';
import { Tag } from '../Tag';
import { openModal } from '@mantine/modals';
import { AlbumCover } from '../Playback/AlbumCover';

type Props = {
	song: SongWTags;
	album?: AlbumSource;
};

export const SongDetailModal = ({ song, album }: Props) => {
	const { tags } = useTags();

	return (
		<Stack align='center'>
			{album && <AlbumCover song={song} album={album} width={'100%'} height={'fit-content'} maxWidth={260} maxHeight={260} />}
			<Text size='xl' fw={600}>{song.title}</Text>
			<Group gap='xs' w='100%' style={{ alignSelf: 'flex-start' }}>
				{tags ? (
					song.tags.map((tagName) => {
						const tag = tags?.get(tagName);
						return tag ? <Tag tag={tag} /> : null;
					})
				) : (
					<Loader size='md' />
				)}
			</Group>
		</Stack>
	);
};

export const openSongDetailModal = (props: Props) => openModal({
	children: <SongDetailModal {...props} />,
	withCloseButton: false,
	styles: {
		content: {
			overflow: 'hidden'
		}
	}
});

