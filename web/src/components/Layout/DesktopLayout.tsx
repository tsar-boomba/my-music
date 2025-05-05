import { ReactNode, useCallback } from 'react';
import Header from './Header';
import { ActionIcon, Box, Group, Stack, useMantineColorScheme } from '@mantine/core';
import { useAuth } from '../../utils/useAuth';
import { TbPlus } from 'react-icons/tb';
import { openModal } from '@mantine/modals';
import { AddSongModal } from '../AddSongModal';
import { CgMoon, CgSun } from 'react-icons/cg';

export const DesktopLayout = ({
	children,
	playbackManager,
}: {
	children?: ReactNode;
	playbackManager: ReactNode;
}) => {
	const { user } = useAuth({ allowAnon: true });
	const { colorScheme, toggleColorScheme } = useMantineColorScheme({
		keepTransitions: true,
	});

	const openAddSongs = useCallback(
		() =>
			openModal({
				title: 'Add Songs',
				children: <AddSongModal />,
			}),
		[],
	);

	return (
		<Stack mih='100%' gap={0} justify='space-between' pt={60}>
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
			<Box
				pos='sticky'
				bottom={0}
				left={0}
				right={0}
				style={{ pointerEvents: 'none', zIndex: 1 }}
			>
				<Stack gap={0}>
					<Group justify='space-between' px='md' bg='transparent' pb='md'>
						<ActionIcon
							size='lg'
							onClick={() => toggleColorScheme()}
							style={{ pointerEvents: 'auto' }}
						>
							{colorScheme === 'dark' ? (
								<CgSun size={18} />
							) : (
								<CgMoon size={18} />
							)}
						</ActionIcon>
						{!user ||
							(user.admin && (
								<ActionIcon
									size='xl'
									radius='xl'
									onClick={openAddSongs}
									style={{ pointerEvents: 'auto' }}
								>
									<TbPlus />
								</ActionIcon>
							))}
					</Group>
					{playbackManager}
				</Stack>
			</Box>
		</Stack>
	);
};
