import {
	ActionIcon,
	Affix,
	Box,
	Stack,
	Tabs,
	useMantineColorScheme,
} from '@mantine/core';
import { ReactNode } from 'react';
import { TbHome2, TbSettings } from 'react-icons/tb';
import { useLocation, useNavigate } from 'react-router';
import * as classes from './MobileLayout.css';
import { CgMoon, CgSun } from 'react-icons/cg';

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

export const MobileLayout = ({ children }: { children?: ReactNode }) => {
	const { colorScheme, toggleColorScheme } = useMantineColorScheme({
		keepTransitions: true,
	});
	const location = useLocation();
	const nav = useNavigate();
	let tab: Page = 'home';

	if (location.pathname.includes('settings')) {
		tab = 'settings';
	}

	return (
		<Box pb={TABS_HEIGHT + 12} style={{ overflow: 'none' }}>
			{children}

			<Affix left={16} bottom={TABS_HEIGHT + 12}>
				<ActionIcon size='lg' onClick={() => toggleColorScheme()}>
					{colorScheme === 'dark' ? <CgSun size={18} /> : <CgMoon size={18} />}
				</ActionIcon>
			</Affix>
			<Affix
				bottom={0}
				left={0}
				right={0}
				h={TABS_HEIGHT}
				className={classes.bottom}
			>
				<Tabs inverted value={tab}>
					<Tabs.List grow>
						{TABS.map(({ name, path, icon, page }) => (
							<Tabs.Tab value={page} onClick={() => nav(path)} key={path}>
								<Stack gap={0} align='center'>
									{icon}
									<div>{name}</div>
								</Stack>
							</Tabs.Tab>
						))}
					</Tabs.List>
				</Tabs>
			</Affix>
		</Box>
	);
};
