import { Tabs } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { Sources } from '../components/Settings/Sources';
import { Tags } from '../components/Settings/Tags';
import { useAuth } from '../utils/useAuth';

export const Settings = () => {
	const {} = useAuth({ admin: true });
	const [tab, setTab] = useLocalStorage({
		key: 'settingsTab',
		defaultValue: 'sources'
	})

	return <Tabs value={tab}>
		<Tabs.List>
			<Tabs.Tab value='sources' onClick={() => setTab('sources')}>Sources</Tabs.Tab>
			<Tabs.Tab value='tags' onClick={() => setTab('tags')}>Tags</Tabs.Tab>
		</Tabs.List>

		<Tabs.Panel value='sources'>
			<Sources />
		</Tabs.Panel>

		<Tabs.Panel value='tags'>
			<Tags />
		</Tabs.Panel>
	</Tabs>;
};
