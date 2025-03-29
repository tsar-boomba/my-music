import useSWR, { KeyedMutator } from 'swr';
import { Tag } from '../types/Tag';
import { apiFetcher } from '../api';
import { Song } from '../types/Song';

export const useTags = (): {
	tags?: Map<string, Tag>;
	tagsArray?: Tag[];
	error: unknown;
	mutate: KeyedMutator<Tag[]>;
} => {
	const {
		data: tagsArray,
		error,
		mutate,
	} = useSWR<Tag[]>('/tags', apiFetcher, {});

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
	const {
		data: songsArray,
		error,
		mutate,
	} = useSWR<SongWTags[]>('/songs', apiFetcher, {});

	return {
		songs: songsArray
			? new Map(songsArray.map((song) => [song.id, song]))
			: undefined,
		songsArray,
		error,
		mutate,
	};
};
