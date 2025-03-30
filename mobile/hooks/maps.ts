import useSWR, { KeyedMutator } from 'swr';
import { Tag } from '../../web/src/types/Tag';
import { Song } from '../../web/src/types/Song';
import { useFetcher } from './fetcher';

export const useTags = (): {
	tags?: Map<string, Tag>;
	tagsArray?: Tag[];
	error: unknown;
	mutate: KeyedMutator<Tag[]>;
} => {
	const fetcher = useFetcher();
	const {
		data: tagsArray,
		error,
		mutate,
	} = useSWR<Tag[]>('/api/tags', fetcher);

	return {
		tags: tagsArray
			? new Map(tagsArray.map((tag) => [tag.name, tag]))
			: undefined,
		tagsArray,
		error,
		mutate,
	};
};

export type SongWTags = Song & { tags: string[] };

export const useSongs = (): {
	songs?: Map<number, SongWTags>;
	songsArray?: SongWTags[];
	error: unknown;
	mutate: KeyedMutator<SongWTags[]>;
} => {
	const fetcher = useFetcher();
	const {
		data: songsArray,
		error,
		mutate,
	} = useSWR<SongWTags[]>('/api/songs', fetcher, {});

	return {
		songs: songsArray
			? new Map(songsArray.map((song) => [song.id, song]))
			: undefined,
		songsArray,
		error,
		mutate,
	};
};
