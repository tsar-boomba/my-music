import { ReactNode, useCallback } from 'react';
import Header from './Header';
import { ActionIcon, Affix, Box, Group, Stack } from '@mantine/core';
import { useAuth } from '../../utils/useAuth';
import { TbPlus } from 'react-icons/tb';
import { openModal } from '@mantine/modals';
import { AddSongModal } from '../AddSongModal';

export const DesktopLayout = ({
	children,
	playbackManager,
}: {
	children?: ReactNode;
	playbackManager: ReactNode;
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
				links={
					!user || user.admin
						? [
								{
									label: 'Home',
									link: '/',
								},
								{
									label: 'Settings',
									link: '/settings',
								},
							]
						: []
				}
			/>
			{children}
			<Affix bottom={0} left={0} right={0}>
				<Stack gap={0}>
					<Group
						justify='flex-end'
						px='md'
						bg='transparent'
						pb='md'
						style={{ pointerEvents: 'none' }}
					>
						{user && user.admin && (
							<ActionIcon
								size='xl'
								radius='xl'
								onClick={openAddSongs}
								style={{ pointerEvents: 'auto' }}
							>
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
