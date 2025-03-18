import { Button, Center, Group, Loader, Paper, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { TbPlus } from 'react-icons/tb';
import useSWR from 'swr';
import { apiFetcher, apiUrl } from '../../api';
import { useAuth } from '../../utils/useAuth';
import { User } from '../../types/User';

export const Users = () => {
	const {} = useAuth({ admin: true });
	const { data: users, error, mutate } = useSWR<User[]>('/users', apiFetcher);
	const [creatingUser, setCreatingUser] = useState(false);
	const { register, handleSubmit } = useForm<{
		username: string;
		password: string;
	}>({
		defaultValues: {
			username: '',
			password: '',
		},
	});

	if (error) {
		return error.toString();
	}

	if (!users) {
		return (
			<Center>
				<Loader size='xl' />
			</Center>
		);
	}

	return (
		<Stack align='center' p='md'>
			<Stack
				component='form'
				onSubmit={handleSubmit(async ({ username, password }) => {
					if (!username || !password) return;
					const body: {
						username: string;
						password: string;
					} = {
						username,
						password,
					};
					setCreatingUser(true);

					try {
						const res = await fetch(apiUrl('/users'), {
							method: 'POST',
							body: JSON.stringify(body),
							headers: {
								['content-type']: 'application/json',
							},
							credentials: 'include'
						});

						if (res.ok) {
							await mutate();
						} else {
							console.error('Failed to create source:', await res.text());
						}
					} catch (e) {
						console.error(e);
					} finally {
						setCreatingUser(false);
					}
				})}
			>
				<TextInput {...register('username')} label='Username' withAsterisk />
				<TextInput {...register('password')} label='Password' withAsterisk />
				<Button leftSection={<TbPlus />} type='submit' loading={creatingUser}>
					Create User
				</Button>
			</Stack>
			<Group justify='center' align='stretch'>
				{users.map((user) => (
					<Paper
						key={user.username}
						withBorder
						shadow='sm'
						p='md'
						maw={250}
					>
						<Text fw={700}>{user.username}</Text>
						<Text>{user.admin ? 'Admin' : 'Not Admin 😭'}</Text>
					</Paper>
				))}
			</Group>
		</Stack>
	);
};
