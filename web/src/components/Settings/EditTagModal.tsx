import { KeyedMutator } from 'swr';
import { Tag as TagType } from '../../types/Tag';
import { useForm } from 'react-hook-form';
import { Button, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { apiUrl } from '../../api';
import { Tag } from '../Tag';

export const EditTagModal = ({
	tag,
	mutate,
}: {
	tag: TagType;
	mutate: KeyedMutator<any>;
}) => {
	const { register, handleSubmit, watch } = useForm<
		Omit<TagType, 'name' | 'created_at' | 'updated_at'>
	>({
		defaultValues: {
			...tag,
		},
	});
	const values = watch();
	const [updating, setUpdating] = useState(false);

	return (
		<Stack
			component='form'
			onSubmit={handleSubmit(
				async ({ backgroundColor, borderColor, textColor }) => {
					const body: TagType = {
						backgroundColor,
						borderColor,
						textColor,
						name: tag.name,
						albumId: null,
						artistId: null,
						
						createdAt: '',
						updatedAt: '',
					};
					setUpdating(true);

					try {
						const res = await fetch(apiUrl('/tags'), {
							method: 'PUT',
							headers: {
								['content-type']: 'application/json',
							},
							body: JSON.stringify(body),
						});

						if (res.ok) {
							mutate();
						}
					} catch (e) {
						console.error(e);
					} finally {
						setUpdating(false);
					}
				},
			)}
		>
			<TextInput {...register('backgroundColor')} label='Background' />
			<TextInput {...register('borderColor')} label='Border' />
			<TextInput {...register('textColor')} label='Text' />
			<div style={{ alignSelf: 'center' }}>
				<Tag tag={{ ...tag, ...values }} />
			</div>
			<Button type='submit' loading={updating}>
				Update
			</Button>
		</Stack>
	);
};
