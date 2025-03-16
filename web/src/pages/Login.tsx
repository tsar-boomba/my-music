import {
	Button,
	Center,
	PasswordInput,
	Stack,
	Text,
	TextInput,
} from '@mantine/core';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiUrl } from '../api';
import { useNavigate } from 'react-router';
import { mutate } from 'swr';
import { User } from '../types/User';

export const Login = () => {
	const { register, handleSubmit } = useForm<{
		username: string;
		password: string;
	}>({
		defaultValues: {
			username: '',
			password: '',
		},
	});
	const navigate = useNavigate();
	const [loggingIn, setLoggingIn] = useState(false);
	const [error, setError] = useState('');

	return (
		<Center h='100vh'>
			<Stack
				component='form'
				maw={200}
				onSubmit={handleSubmit(async ({ username, password }) => {
					if (!username || !password) return;
					setLoggingIn(true);
					setError('');

					try {
						const res = await fetch(apiUrl('/login'), {
							method: 'POST',
							headers: {
								['content-type']: 'application/json',
							},
							body: JSON.stringify({ username, password }),
						});

						if (res.ok) {
							const user: User = await res.json();
							await mutate(apiUrl('/check-auth'), user);
							navigate('/');
						} else if (res.status > 499) {
							setError('Internal server error');
						} else {
							setError('Incorrect username or password');
						}
					} catch (e) {
						console.error(e);
						setError(e?.toString() || 'Unexpected error');
					} finally {
						setLoggingIn(false);
					}
				})}
			>
				<TextInput {...register('username')} label='Username' />
				<PasswordInput {...register('password')} label='Password' />
				{error && <Text c='red'>{error}</Text>}
				<Button type='submit' loading={loggingIn}>
					Login
				</Button>
			</Stack>
		</Center>
	);
};
