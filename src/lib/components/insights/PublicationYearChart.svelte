<script lang="ts">
	import type { PublicationYearBucket } from '$lib/server/insights/stats';

	let {
		data,
		selected = null,
		onSelect
	}: { data: PublicationYearBucket[]; selected?: string | null; onSelect: (label: string) => void } =
		$props();

	let max = $derived(Math.max(1, ...data.map((d) => d.count)));
	let hoveredLabel = $state<string | null>(null);
</script>

<div class="genre-chart">
	{#if data.length === 0}
		<p class="insights-empty">
			No publication years on file yet — they show up here once your books have one.
		</p>
	{:else}
		<div class="genre-chart__rows">
			{#each data as row (row.label)}
				<button
					type="button"
					class="genre-chart__row"
					class:genre-chart__row--selected={selected === row.label}
					aria-label="{row.label}: {row.count} book{row.count === 1 ? '' : 's'} — see these books"
					onclick={() => onSelect(row.label)}
					onmouseenter={() => (hoveredLabel = row.label)}
					onmouseleave={() => (hoveredLabel = null)}
					onfocus={() => (hoveredLabel = row.label)}
					onblur={() => (hoveredLabel = null)}
				>
					<span class="genre-chart__label">{row.label}</span>
					<div class="genre-chart__track">
						<div class="genre-chart__bar" style="width: {(row.count / max) * 100}%"></div>
					</div>
					<span class="genre-chart__value">{row.count}</span>
					{#if hoveredLabel === row.label}
						<div class="chart-tooltip" role="tooltip">
							<strong>{row.count}</strong> book{row.count === 1 ? '' : 's'} published in
							<strong>{row.label}</strong> — click to see them
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
