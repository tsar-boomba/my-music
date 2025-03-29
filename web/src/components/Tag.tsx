import { MantineSize, Pill } from '@mantine/core';
import { Tag as TagType } from '../types/Tag';

export const Tag = ({
	tag,
	size,
	onRemove,
	onClick,
}: {
	tag: TagType;
	size?: MantineSize;
	onRemove?: () => void;
	onClick?: () => void;
}) => {
	return (
		<Pill
			size={size}
			styles={{
				label: {
					height: 'auto',
				},
			}}
			bg={tag.backgroundColor ?? undefined}
			c={tag.textColor ?? undefined}
			style={{
				textTransform: 'uppercase',
				border: tag.borderColor ? `1px solid ${tag.borderColor}` : '1px solid var(--mantine-color-gray-8)',
			}}
			withRemoveButton={!!onRemove}
			onRemove={onRemove}
			onClick={onClick}
			fw={1000}
		>
			{tag.name}
		</Pill>
	);
};
