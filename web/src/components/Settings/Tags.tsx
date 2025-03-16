import { Button, Center, Group, Loader, Stack, TextInput } from '@mantine/core';
import { useTags } from '../../utils/tags';
import { Tag } from '../Tag';
import { TbPlus } from 'react-icons/tb';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Tag as TagType } from '../../types/Tag';
import { apiUrl } from '../../api';
import { openModal } from '@mantine/modals';
import { EditTagModal } from './EditTagModal';

export const Tags = () => {
	const { tags, error, mutate } = useTags();
	const [creatingSource, setCreatingSource] = useState(false);
	const { register, handleSubmit } = useForm<{
		name: string;
		backgroundColor: string;
		textColor: string;
		borderColor: string;
	}>({
		defaultValues: {
			name: '',
			backgroundColor: '',
			textColor: '',
			borderColor: '',
		},
	});

	if (error) {
		return error.toString();
	}

	if (!tags) {
		return (
			<Center>
				<Loader size='xl' />
			</Center>
		);
	}

	return (
		<Stack align='center'>
			<Stack
				component='form'
				onSubmit={handleSubmit(
					async ({ name, backgroundColor, borderColor, textColor }) => {
						const body: TagType = {
							name,
							backgroundColor,
							borderColor,
							textColor,
							albumId: null,
							artistId: null,

							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						};
						setCreatingSource(true);

						try {
							const res = await fetch(apiUrl('/tags'), {
								method: 'POST',
								body: JSON.stringify(body, null, 4),
								headers: {
									['content-type']: 'application/json',
								},
							});

							if (res.ok) {
								console.log('Created source:', await res.json());
								await mutate();
							} else {
								console.error('Failed to create source:', await res.text());
							}
						} catch (e) {
							console.error(e);
						} finally {
							setCreatingSource(false);
						}
					},
				)}
			>
				<TextInput {...register('name')} label='Name' withAsterisk />
				<TextInput
					{...register('backgroundColor')}
					label='Background Color'
					withAsterisk
				/>
				<Button leftSection={<TbPlus />} type='submit' loading={creatingSource}>
					Add Tag
				</Button>
			</Stack>
			<Group px={8}>
				{Array.from(tags.values()).map((tag) => (
					<div style={{ cursor: 'pointer' }}>
						<Tag
							key={tag.name}
							tag={tag}
							onClick={() =>
								openModal({
									title: `Update ${tag.name}`,
									children: (
										<EditTagModal tag={tag} mutate={mutate} />
									),
								})
							}
						/>
					</div>
				))}
			</Group>
		</Stack>
	);
};
