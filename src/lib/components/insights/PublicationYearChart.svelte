<script lang="ts">
	import type { PublicationYearBucket } from '$lib/server/insights/stats';

	let { data }: { data: PublicationYearBucket[] } = $props();

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
				<div
					class="genre-chart__row"
					role="button"
					aria-label="{row.label}: {row.count} book{row.count === 1 ? '' : 's'}"
					onmouseenter={() => (hoveredLabel = row.label)}
					onmouseleave={() => (hoveredLabel = null)}
					onfocus={() => (hoveredLabel = row.label)}
					onblur={() => (hoveredLabel = null)}
					tabindex="0"
				>
					<span class="genre-chart__label">{row.label}</span>
					<div class="genre-chart__track">
						<div class="genre-chart__bar" style="width: {(row.count / max) * 100}%"></div>
					</div>
					<span class="genre-chart__value">{row.count}</span>
					{#if hoveredLabel === row.label}
						<div class="chart-tooltip" role="tooltip">
							<strong>{row.count}</strong> book{row.count === 1 ? '' : 's'} published in
							<strong>{row.label}</strong>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
