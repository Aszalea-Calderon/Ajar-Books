<script lang="ts">
	import type { FictionSplit } from '$lib/server/insights/stats';

	let { split }: { split: FictionSplit } = $props();

	const SEGMENTS = [
		{ key: 'fiction' as const, label: 'Fiction', cssVar: '--color-viz-gold' },
		{ key: 'nonfiction' as const, label: 'Nonfiction', cssVar: '--color-viz-blue' },
		{ key: 'unclassified' as const, label: 'Not yet tagged', cssVar: null }
	];

	let total = $derived(split.fiction + split.nonfiction + split.unclassified);
	let hovered = $state<string | null>(null);

	function percent(count: number) {
		return total ? Math.round((count / total) * 100) : 0;
	}
</script>

<div class="fiction-split">
	{#if total === 0}
		<p class="insights-empty">No genre-tagged books yet.</p>
	{:else}
		<div class="fiction-split__track">
			{#each SEGMENTS as segment (segment.key)}
				{@const count = split[segment.key]}
				{@const pct = percent(count)}
				{#if count > 0}
					<div
						class="fiction-split__segment"
						class:fiction-split__segment--unclassified={!segment.cssVar}
						style={segment.cssVar ? `width: ${pct}%; background: var(${segment.cssVar})` : `width: ${pct}%`}
						role="button"
						aria-label="{segment.label}: {count} book{count === 1 ? '' : 's'} ({pct}%)"
						onmouseenter={() => (hovered = segment.key)}
						onmouseleave={() => (hovered = null)}
						onfocus={() => (hovered = segment.key)}
						onblur={() => (hovered = null)}
						tabindex="0"
					>
						{#if pct >= 12}
							<span class="fiction-split__inline-label">{pct}%</span>
						{/if}
						{#if hovered === segment.key}
							<div class="chart-tooltip" role="tooltip">
								<strong>{count}</strong> book{count === 1 ? '' : 's'} — {segment.label} ({pct}%)
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
		<ul class="fiction-split__legend">
			{#each SEGMENTS as segment (segment.key)}
				{#if split[segment.key] > 0}
					<li>
						<span
							class="fiction-split__swatch"
							class:fiction-split__swatch--unclassified={!segment.cssVar}
							style={segment.cssVar ? `background: var(${segment.cssVar})` : ''}
						></span>
						{segment.label} ({split[segment.key]})
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</div>
