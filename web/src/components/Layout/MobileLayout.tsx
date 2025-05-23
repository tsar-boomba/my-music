import {
	ActionIcon,
	Box,
	Group,
	Stack,
	Tabs,
	useMantineColorScheme,
} from '@mantine/core';
import { ReactNode, useCallback } from 'react';
import { TbHome2, TbPlus, TbSettings } from 'react-icons/tb';
import { useLocation, useNavigate } from 'react-router';
import * as classes from './MobileLayout.css';
import { CgMoon, CgSun } from 'react-icons/cg';
import { useAuth } from '../../utils/useAuth';
import { openModal } from '@mantine/modals';
import { AddSongModal } from '../AddSongModal';

export const TABS_HEIGHT = 50;

type Page = 'home' | 'settings';
const TABS: {
	name: string;
	path: string;
	icon: ReactNode;
	page: Page;
}[] = [
	{ name: 'Home', path: '/', page: 'home', icon: <TbHome2 /> },
	{
		name: 'Settings',
		path: '/settings',
		page: 'settings',
		icon: <TbSettings />,
	},
];

export const MobileLayout = ({
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
	const location = useLocation();
	const nav = useNavigate();
	let tab: Page = 'home';

	const openAddSongs = useCallback(
		() =>
			openModal({
				title: 'Add Songs',
				children: <AddSongModal />,
			}),
		[],
	);

	if (location.pathname.includes('settings')) {
		tab = 'settings';
	}

	return (
		<Stack mih='100%' gap={0} justify='space-between'>
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
					{user?.admin && (
						<Tabs
							inverted
							value={tab}
							className={classes.bottom}
							style={{ pointerEvents: 'auto' }}
						>
							<Tabs.List grow>
								{TABS.map(({ name, path, icon, page }) => (
									<Tabs.Tab
										value={page}
										onClick={() => nav(path)}
										key={path}
										py='md'
									>
										<Stack gap={2} align='center'>
											{icon}
											<div>{name}</div>
										</Stack>
									</Tabs.Tab>
								))}
							</Tabs.List>
						</Tabs>
					)}
				</Stack>
			</Box>
		</Stack>
	);
};
