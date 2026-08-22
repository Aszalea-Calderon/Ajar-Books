<script lang="ts">
	import type { AuthorCount } from '$lib/server/insights/stats';

	let {
		data,
		selected = null,
		onSelect
	}: { data: AuthorCount[]; selected?: string | null; onSelect: (author: string) => void } = $props();

	let max = $derived(Math.max(1, ...data.map((d) => d.count)));
</script>

<div class="genre-chart">
	{#if data.length === 0}
		<p class="insights-empty">No authors on file yet — they show up here once you add some books.</p>
	{:else}
		<div class="genre-chart__rows">
			{#each data as row, i (row.author)}
				<button
					type="button"
					class="genre-chart__row"
					class:genre-chart__row--selected={selected === row.author}
					aria-label="#{i + 1}: {row.author}, {row.count} book{row.count === 1 ? '' : 's'} — see these books"
					onclick={() => onSelect(row.author)}
				>
					<span class="genre-chart__label">{i + 1}. {row.author}</span>
					<div class="genre-chart__track">
						<div class="genre-chart__bar" style="width: {(row.count / max) * 100}%"></div>
					</div>
					<span class="genre-chart__value">{row.count}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
