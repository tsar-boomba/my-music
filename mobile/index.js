import { registerRootComponent } from 'expo';
import { registerPlayerService } from './utils/player';
import { ExpoRoot } from 'expo-router';

export const App = () => {
	const context = require.context('./app');
	return <ExpoRoot context={context} />;
};

console.log('main.jsx');
registerRootComponent(App);
registerPlayerService();
