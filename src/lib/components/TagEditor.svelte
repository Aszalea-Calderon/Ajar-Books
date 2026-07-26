<script lang="ts">
	import { enhance } from '$app/forms';

	let {
		label,
		type,
		tags,
		suggestions
	}: {
		label: string;
		type: 'genre' | 'mood' | 'setting';
		tags: { id: string; name: string }[];
		suggestions: string[];
	} = $props();

	let newTagName = $state('');
</script>

<div class="tag-editor">
	<h4 class="tag-editor__label">{label}</h4>
	<div class="tag-editor__chips">
		{#each tags as tag (tag.id)}
			<form method="POST" action="?/removeTag" use:enhance class="tag-chip">
				<input type="hidden" name="tagId" value={tag.id} />
				<span>{tag.name}</span>
				<button type="submit" class="tag-chip__remove" aria-label="Remove {tag.name}">×</button>
			</form>
		{/each}

		<form
			method="POST"
			action="?/addTag"
			class="tag-editor__add"
			use:enhance={() => {
				return async ({ update }) => {
					newTagName = '';
					await update();
				};
			}}
		>
			<input type="hidden" name="type" value={type} />
			<input
				class="tag-editor__input"
				list="tag-suggestions-{type}"
				name="name"
				placeholder="+ add"
				bind:value={newTagName}
			/>
			<datalist id="tag-suggestions-{type}">
				{#each suggestions as suggestion (suggestion)}
					<option value={suggestion}></option>
				{/each}
			</datalist>
		</form>
	</div>
</div>
