<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';
	import type { TagType, TagWithUsage } from '$lib/server/books/tags';

	let {
		manageableTags,
		onRequestConfirm
	}: {
		manageableTags: Record<TagType, TagWithUsage[]>;
		onRequestConfirm: (event: MouseEvent, message: string, label?: string, confirmText?: string) => void;
	} = $props();

	const TAG_SECTIONS: { type: TagType; label: string }[] = [
		{ type: 'genre', label: 'Genre' },
		{ type: 'mood', label: 'Mood' },
		{ type: 'setting', label: 'Setting' }
	];

	function deleteTagConfirmMessage(tag: TagWithUsage) {
		return tag.usageCount > 0
			? `Delete the tag "${tag.name}"? It will be removed from ${tag.usageCount} ${tag.usageCount === 1 ? 'book' : 'books'}.`
			: `Delete the tag "${tag.name}"?`;
	}

	// One shared sort applied to every type's table, rather than one per
	// type — the three tables are small enough that a consistent sort across
	// all of them is easier to scan than tracking three independent orders.
	type SortKey = 'name' | 'usage';
	let sortKey = $state<SortKey>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			// Usage defaults to highest-first (the more actionable end for
			// spotting bulk-cleanup candidates); name defaults A→Z.
			sortDir = key === 'usage' ? 'desc' : 'asc';
		}
	}

	function sortedTags(list: TagWithUsage[]) {
		return [...list].sort((a, b) => {
			const cmp =
				sortKey === 'usage' ? a.usageCount - b.usageCount : a.name.localeCompare(b.name);
			return sortDir === 'asc' ? cmp : -cmp;
		});
	}

	// Selection spans all three types at once — deleteTagsGlobally doesn't
	// care about type, and one "N selected" toolbar is simpler than three.
	const selected = new SvelteSet<string>();

	function toggleAllForType(list: TagWithUsage[]) {
		const allSelected = list.every((t) => selected.has(t.id));
		for (const t of list) {
			if (allSelected) selected.delete(t.id);
			else selected.add(t.id);
		}
	}

	function deleteSelectedConfirmMessage() {
		const n = selected.size;
		return `Delete ${n} selected ${n === 1 ? 'tag' : 'tags'}? ${n === 1 ? 'It' : 'They'} will be removed from every book that has ${n === 1 ? 'it' : 'them'}.`;
	}
</script>

<h3>Manage Tags</h3>
<p class="settings-hint">
	Rename or delete genre, mood, and setting tags across your whole library. Renaming a tag to
	match an existing one merges the two together.
</p>

{#if selected.size > 0}
	<form
		method="POST"
		action="/profile?/deleteTags"
		use:enhance={() => {
			return async ({ update }) => {
				selected.clear();
				await update();
			};
		}}
	>
		{#each [...selected] as id (id)}
			<input type="hidden" name="tagIds" value={id} />
		{/each}
		<div class="manage-tags__bulk-bar">
			<span>{selected.size} selected</span>
			<button
				type="button"
				class="manage-tags__delete manage-tags__delete--bulk"
				onclick={(event) => onRequestConfirm(event, deleteSelectedConfirmMessage(), 'Delete')}
			>
				Delete selected
			</button>
		</div>
	</form>
{/if}

{#each TAG_SECTIONS as tagSection (tagSection.type)}
	<h4 class="manage-tags__type-label">{tagSection.label}</h4>
	{#if manageableTags[tagSection.type].length === 0}
		<p class="settings-hint">No {tagSection.label.toLowerCase()} tags yet.</p>
	{:else}
		<div class="data-table-wrap">
			<table class="data-table manage-tags__table">
				<thead>
					<tr>
						<th class="manage-tags__checkbox-cell">
							<input
								type="checkbox"
								aria-label="Select all {tagSection.label.toLowerCase()} tags"
								checked={manageableTags[tagSection.type].every((t) => selected.has(t.id))}
								onchange={() => toggleAllForType(manageableTags[tagSection.type])}
							/>
						</th>
						<th>
							<button type="button" class="data-table__sort" onclick={() => toggleSort('name')}>
								Name{#if sortKey === 'name'}<span class="data-table__sort-arrow"
										>{sortDir === 'asc' ? '▲' : '▼'}</span
									>{/if}
							</button>
						</th>
						<th>
							<button type="button" class="data-table__sort" onclick={() => toggleSort('usage')}>
								Books{#if sortKey === 'usage'}<span class="data-table__sort-arrow"
										>{sortDir === 'asc' ? '▲' : '▼'}</span
									>{/if}
							</button>
						</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each sortedTags(manageableTags[tagSection.type]) as tag (tag.id)}
						<tr>
							<td class="manage-tags__checkbox-cell">
								<input
									type="checkbox"
									aria-label="Select {tag.name}"
									checked={selected.has(tag.id)}
									onchange={() => (selected.has(tag.id) ? selected.delete(tag.id) : selected.add(tag.id))}
								/>
							</td>
							<td>
								<form method="POST" action="/profile?/renameTag" use:enhance>
									<input type="hidden" name="tagId" value={tag.id} />
									<input
										class="manage-tags__name-input"
										name="name"
										value={tag.name}
										aria-label="Rename {tag.name}"
										onchange={(event) => event.currentTarget.form?.requestSubmit()}
									/>
								</form>
							</td>
							<td class="manage-tags__usage">
								{tag.usageCount}
								{tag.usageCount === 1 ? 'book' : 'books'}
							</td>
							<td>
								<form
									method="POST"
									action="/profile?/deleteTag"
									use:enhance={() => {
										return async ({ update }) => {
											selected.delete(tag.id);
											await update();
										};
									}}
								>
									<input type="hidden" name="tagId" value={tag.id} />
									<button
										type="button"
										class="manage-tags__delete"
										aria-label="Delete {tag.name}"
										title="Delete {tag.name}"
										onclick={(event) => onRequestConfirm(event, deleteTagConfirmMessage(tag), 'Delete')}
									>
										<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
											<path
												fill="currentColor"
												d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
											/>
										</svg>
									</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/each}
