<script lang="ts">
	import type { YearCount } from '$lib/server/insights/stats';

	let {
		data,
		selected = null,
		onSelect
	}: { data: YearCount[]; selected?: number | null; onSelect: (year: number) => void } = $props();

	let max = $derived(Math.max(1, ...data.map((d) => d.count)));
	let hoveredYear = $state<number | null>(null);
</script>

<div class="yearly-chart">
	{#if data.length === 0}
		<p class="insights-empty">Finish a book to see your yearly trend here.</p>
	{:else}
		<div class="yearly-chart__bars">
			{#each data as row (row.year)}
				<div class="yearly-chart__col">
					<div class="yearly-chart__bar-wrap">
						{#if row.count === max}
							<span class="yearly-chart__value">{row.count}</span>
						{/if}
						<button
							type="button"
							class="yearly-chart__bar"
							class:yearly-chart__bar--selected={selected === row.year}
							style="height: {(row.count / max) * 100}%"
							aria-label="{row.year}: {row.count} book{row.count === 1 ? '' : 's'} finished — see these books"
							onclick={() => onSelect(row.year)}
							onmouseenter={() => (hoveredYear = row.year)}
							onmouseleave={() => (hoveredYear = null)}
							onfocus={() => (hoveredYear = row.year)}
							onblur={() => (hoveredYear = null)}
						></button>
						{#if hoveredYear === row.year}
							<div class="chart-tooltip chart-tooltip--above" role="tooltip">
								<strong>{row.count}</strong> book{row.count === 1 ? '' : 's'} in {row.year}
							</div>
						{/if}
					</div>
					<span class="yearly-chart__axis-label">{row.year}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
