<script lang="ts">
	import type { YearCount } from '$lib/server/insights/stats';

	let { data }: { data: YearCount[] } = $props();

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
						<div
							class="yearly-chart__bar"
							style="height: {(row.count / max) * 100}%"
							role="button"
							aria-label="{row.year}: {row.count} book{row.count === 1 ? '' : 's'} finished"
							onmouseenter={() => (hoveredYear = row.year)}
							onmouseleave={() => (hoveredYear = null)}
							onfocus={() => (hoveredYear = row.year)}
							onblur={() => (hoveredYear = null)}
							tabindex="0"
						></div>
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
