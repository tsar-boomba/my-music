import { ReactNode, useCallback } from 'react';
import Header from './Header';
import { ActionIcon, Affix, Box, Group, Stack } from '@mantine/core';
import {
	PlaybackManagerProvider,
	PlayingManagerContext,
} from '../Playback/PlaybackManager';
import { useAuth } from '../../utils/useAuth';
import { TbPlus } from 'react-icons/tb';
import { openModal } from '@mantine/modals';
import { AddSongModal } from '../AddSongModal';

export const DesktopLayout = ({
	children,
	playbackRef,
	playbackManager
}: {
	children?: ReactNode;
	playbackManager: ReactNode;
	playbackRef: PlayingManagerContext;
}) => {
	const { user } = useAuth({ allowAnon: true });

	const openAddSongs = useCallback(
		() =>
			openModal({
				title: 'Add Songs',
				children: <AddSongModal />,
			}),
		[],
	);

	return (
		<Box pt={60}>
			<Header
				links={[
					{
						label: 'Home',
						link: '/',
					},
					{
						label: 'Settings',
						link: '/settings',
					},
				]}
			/>
			<PlaybackManagerProvider ref={playbackRef}>
				{children}
			</PlaybackManagerProvider>
			<Affix bottom={0} left={0} right={0} pb='md'>
				<Stack>
					<Group justify='flex-end' px='md'>
						{user && user.admin && (
							<ActionIcon size='xl' radius='xl' onClick={openAddSongs}>
								<TbPlus strokeWidth={3} />
							</ActionIcon>
						)}
					</Group>
					{playbackManager}
				</Stack>
			</Affix>
		</Box>
	);
};
