<script lang="ts">
	import type { GenreCount } from '$lib/server/insights/stats';

	let { data }: { data: GenreCount[] } = $props();

	let max = $derived(Math.max(1, ...data.map((d) => d.count)));
	let hoveredGenre = $state<string | null>(null);
</script>

<div class="genre-chart">
	{#if data.length === 0}
		<p class="insights-empty">No tagged books yet — genre tags show up here once you add some.</p>
	{:else}
		<div class="genre-chart__rows">
			{#each data as row (row.genre)}
				<div
					class="genre-chart__row"
					role="button"
					aria-label="{row.genre}: {row.count} book{row.count === 1 ? '' : 's'}"
					onmouseenter={() => (hoveredGenre = row.genre)}
					onmouseleave={() => (hoveredGenre = null)}
					onfocus={() => (hoveredGenre = row.genre)}
					onblur={() => (hoveredGenre = null)}
					tabindex="0"
				>
					<span class="genre-chart__label">{row.genre}</span>
					<div class="genre-chart__track">
						<div class="genre-chart__bar" style="width: {(row.count / max) * 100}%"></div>
					</div>
					<span class="genre-chart__value">{row.count}</span>
					{#if hoveredGenre === row.genre}
						<div class="chart-tooltip" role="tooltip">
							<strong>{row.count}</strong> book{row.count === 1 ? '' : 's'} tagged
							<strong>{row.genre}</strong>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
