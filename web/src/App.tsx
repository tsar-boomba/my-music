import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { theme } from './theme';
import { Outlet, useLocation } from 'react-router';
import { Layout } from './components/Layout';

export default function App() {
	const location = useLocation();

	if (location.pathname === '/login') {
		return (
			<MantineProvider theme={theme}>
				<ModalsProvider>
					<Outlet />
				</ModalsProvider>
			</MantineProvider>
		);
	}

	return (
		<MantineProvider theme={theme}>
			<ModalsProvider>
				<Layout>
					<Outlet />
				</Layout>
			</ModalsProvider>
		</MantineProvider>
	);
}
