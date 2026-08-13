<script lang="ts">
	import { enhance } from '$app/forms';
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
</script>

<h3>Manage Tags</h3>
<p class="settings-hint">
	Rename or delete genre, mood, and setting tags across your whole library. Renaming a tag to
	match an existing one merges the two together.
</p>
{#each TAG_SECTIONS as tagSection (tagSection.type)}
	<h4 class="manage-tags__type-label">{tagSection.label}</h4>
	{#if manageableTags[tagSection.type].length === 0}
		<p class="settings-hint">No {tagSection.label.toLowerCase()} tags yet.</p>
	{:else}
		<ul class="manage-tags__list">
			{#each manageableTags[tagSection.type] as tag (tag.id)}
				<li class="manage-tags__row">
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
					<span class="manage-tags__usage">
						{tag.usageCount}
						{tag.usageCount === 1 ? 'book' : 'books'}
					</span>
					<form method="POST" action="/profile?/deleteTag" use:enhance>
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
				</li>
			{/each}
		</ul>
	{/if}
{/each}
