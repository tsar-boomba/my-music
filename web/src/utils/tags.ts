import useSWR, { KeyedMutator } from 'swr';
import { Tag } from '../types/Tag';
import { apiFetcher } from '../api';

export const useTags = (): {
	tags?: Map<string, Tag>;
	tagsArray?: Tag[];
	error: unknown;
	mutate: KeyedMutator<Tag[]>;
} => {
	const { data: tagsArray, error, mutate } = useSWR<Tag[]>('/tags', apiFetcher, {});

	return {
		tags: tagsArray
			? new Map(tagsArray.map((tag) => [tag.name, tag]))
			: undefined,
		tagsArray,
		error,
		mutate,
	};
};
