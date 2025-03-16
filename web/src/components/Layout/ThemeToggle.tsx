import { Switch, useMantineColorScheme, Tooltip, Group, rem } from '@mantine/core';
import { CgSun, CgMoon } from 'react-icons/cg';
import { icon } from './ThemeToggle.css';

export const ThemeToggle = () => {
	const { colorScheme, toggleColorScheme } = useMantineColorScheme({ keepTransitions: true });

	return (
		<Tooltip withinPortal withArrow label='Toggle Theme'>
			<Group my={rem(30)} justify='center'>
				<Switch
					checked={colorScheme === 'dark'}
					onChange={() => toggleColorScheme()}
					offLabel={<CgMoon className={icon} size={18} />}
					onLabel={<CgSun className={icon} size={18} />}
					size='md'
				/>
			</Group>
		</Tooltip>
	);
};
