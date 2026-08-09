<script lang="ts">
	import type { MonthlyMetrics } from '$lib/server/insights/stats';

	let { data }: { data: MonthlyMetrics[] } = $props();

	const PANELS = [
		{ key: 'booksFinished' as const, title: 'Books finished', cssVar: '--color-viz-purple', unit: '' },
		{ key: 'minutesRead' as const, title: 'Minutes listened', cssVar: '--color-viz-blue', unit: 'm' },
		{ key: 'pagesRead' as const, title: 'Pages read', cssVar: '--color-viz-green', unit: '' }
	];

	function monthLabel(month: string) {
		const [year, m] = month.split('-').map(Number);
		return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
	}

	let hovered = $state<string | null>(null);
</script>

<div class="monthly-panels">
	{#each PANELS as panel (panel.key)}
		{@const max = Math.max(1, ...data.map((d) => d[panel.key]))}
		<div class="monthly-panel">
			<h3 class="monthly-panel__title">{panel.title}</h3>
			<div class="monthly-panel__bars">
				{#each data as row (row.month)}
					{@const value = row[panel.key]}
					{@const cellKey = `${panel.key}-${row.month}`}
					<div class="monthly-panel__col">
						<div class="monthly-panel__bar-wrap">
							<div
								class="monthly-panel__bar"
								style="height: {(value / max) * 100}%; background: var({panel.cssVar})"
								role="button"
								aria-label="{monthLabel(row.month)}: {value}{panel.unit} {panel.title.toLowerCase()}"
								onmouseenter={() => (hovered = cellKey)}
								onmouseleave={() => (hovered = null)}
								onfocus={() => (hovered = cellKey)}
								onblur={() => (hovered = null)}
								tabindex="0"
							></div>
							{#if hovered === cellKey}
								<div class="chart-tooltip chart-tooltip--above">
									<strong>{value}{panel.unit}</strong> {panel.title.toLowerCase()}
								</div>
							{/if}
						</div>
						<span class="monthly-panel__axis-label">{monthLabel(row.month)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>
