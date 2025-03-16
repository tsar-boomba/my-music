import {
	Button,
	Center,
	Group,
	List,
	Loader,
	LoadingOverlay,
	Stack,
	Stepper,
	Text,
	TextInput,
} from '@mantine/core';
import { TbUpload, TbX, TbMusic } from 'react-icons/tb';
import {
	Dropzone as MantineDropzone,
	DropzoneProps,
	FileWithPath,
} from '@mantine/dropzone';
import { useAuth } from '../../utils/useAuth';
import { Dispatch, SetStateAction, useRef, useState } from 'react';
import { FinalMetadata, handleUpload, ParsedMetadata } from './uploadMusic';

export const AddSongModal = () => {
	const { user } = useAuth({ admin: true });
	const [files, setFiles] = useState<FileWithPath[]>([]);
	const [metadata, setMetadata] = useState<ParsedMetadata | null>(null);
	const [uploading, setUploading] = useState(-1);
	const [active, setActive] = useState(0);
	const [error, setError] = useState('');
	const finalMetaRef = useRef<{
		resolve?: (finalMeta: FinalMetadata) => void;
		promise: Promise<FinalMetadata>;
	}>({
		resolve: undefined,
		promise: Promise.resolve() as any,
	});

	const nextStep = () =>
		setActive((current) => (current < 2 ? current + 1 : current));
	const prevStep = () =>
		setActive((current) => (current > 0 ? current - 1 : current));

	if (!user) {
		return (
			<Center>
				<Loader size='xl' />
			</Center>
		);
	}

	return (
		<Stepper active={active} onStepClick={() => {}}>
			<Stepper.Step label='Upload Files'>
				<Stack align='center'>
					<Dropzone loading={uploading !== -1} setFiles={setFiles} />
					{!!files.length && (
						<List>
							{files.map(({ name }, i) => (
								<List.Item key={name + i}>{name}</List.Item>
							))}
						</List>
					)}
					{error && <Text c='red'>{error}</Text>}
					<Button
						disabled={!files.length}
						loading={uploading !== -1}
						onClick={() => {
							nextStep();
							handleUpload(
								files,
								setUploading,
								setMetadata,
								setError,
								finalMetaRef,
							)
								.then(() => {
									console.log('upload done');
									setUploading(-1);
									nextStep();
									setError('');
								})
								.catch((err) => {
									console.error(err);
									setUploading(-1);
									setMetadata(null);
									prevStep();
								});
						}}
					>
						Begin Upload
					</Button>
				</Stack>
			</Stepper.Step>
			<Stepper.Step label='Edit Metadata'>
				<Stack align='stretch' pos='relative'>
					<LoadingOverlay
						visible={!metadata && !error}
						zIndex={1000}
						overlayProps={{ radius: 'sm' }}
					/>
					<TextInput
						label='Title'
						value={metadata?.title ?? ''}
						onChange={(e) =>
							setMetadata((prev) => ({ ...prev!, title: e.target.value }))
						}
					/>
					<TextInput
						label='Artist'
						value={metadata?.artists[0] ?? ''}
						onChange={(e) =>
							setMetadata((prev) => ({ ...prev!, artists: [e.target.value] }))
						}
					/>
					<TextInput
						label='Album'
						value={metadata?.album ?? ''}
						onChange={(e) =>
							setMetadata((prev) => ({ ...prev!, album: e.target.value }))
						}
					/>
					{error && <Text c='red'>{error}</Text>}
					<Button
						style={{ alignSelf: 'center' }}
						onClick={() => {
							console.log('submitting', metadata);
							if (
								!metadata ||
								!metadata.title ||
								!metadata.album ||
								!metadata.artists.length
							)
								return;

							if (!finalMetaRef.current.resolve) {
								console.error('no resolve for final meta!?');
								return;
							}

							setError('');
							finalMetaRef.current.resolve({
								title: metadata.title,
								album: metadata.album,
								artists: metadata.artists,
							});
						}}
					>
						Submit
					</Button>
				</Stack>
			</Stepper.Step>
			<Stepper.Completed>Completed!</Stepper.Completed>
		</Stepper>
	);
};

export function Dropzone({
	setFiles,
	...props
}: Partial<DropzoneProps> & {
	setFiles: Dispatch<SetStateAction<FileWithPath[]>>;
}) {
	return (
		<MantineDropzone
			onDrop={(files) => {
				console.log(files);
				setFiles(files);
			}}
			onReject={(files) => console.log('rejected files', files)}
			maxSize={128 * 1024 ** 2}
			accept={['audio/*']}
			{...props}
		>
			<Group
				justify='center'
				gap='xl'
				mih={220}
				style={{ pointerEvents: 'none' }}
			>
				<MantineDropzone.Accept>
					<TbUpload size={52} color='var(--mantine-color-blue-6)' />
				</MantineDropzone.Accept>
				<MantineDropzone.Reject>
					<TbX size={52} color='var(--mantine-color-red-6)' />
				</MantineDropzone.Reject>
				<MantineDropzone.Idle>
					<TbMusic size={52} color='var(--mantine-color-dimmed)' />
				</MantineDropzone.Idle>

				<div>
					<Text size='xl' inline>
						Drag music here or click to select files
					</Text>
					<Text size='sm' c='dimmed' inline mt={7}>
						Attach as many files as you like, each file should not exceed 128mb
					</Text>
				</div>
			</Group>
		</MantineDropzone>
	);
}
