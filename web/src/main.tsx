import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Home } from './pages/Home.tsx';
import { preload } from 'swr';
import { apiFetcher } from './api/index.ts';
import { Settings } from './pages/Settings.tsx';
import { Login } from './pages/Login.tsx';

preload('/check-auth', apiFetcher);
preload('/tags', apiFetcher);
preload('/sources', apiFetcher);
preload('/songs', apiFetcher);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path='/' element={<App />}>
					<Route index element={<Home />} />
					<Route path='settings' element={<Settings />} />
					<Route path='login' element={<Login />} />
				</Route>
			</Routes>
		</BrowserRouter>
	</React.StrictMode>,
);
