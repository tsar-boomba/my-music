import { ReactNode } from 'react';
import Header from './Header';
import { Box } from '@mantine/core';

export const DesktopLayout = ({ children }: { children?: ReactNode }) => {
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
			{children}
		</Box>
	);
};
