<script lang="ts">
	import type { FictionSplit } from '$lib/server/insights/stats';
	import type { FictionCategory } from '$lib/server/insights/genreClassification';

	let {
		split,
		selected = null,
		onSelect
	}: { split: FictionSplit; selected?: FictionCategory | null; onSelect: (category: FictionCategory) => void } =
		$props();

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
					<button
						type="button"
						class="fiction-split__segment"
						class:fiction-split__segment--unclassified={!segment.cssVar}
						class:fiction-split__segment--selected={selected === segment.key}
						style={segment.cssVar ? `width: ${pct}%; background: var(${segment.cssVar})` : `width: ${pct}%`}
						aria-label="{segment.label}: {count} book{count === 1 ? '' : 's'} ({pct}%) — see these books"
						onclick={() => onSelect(segment.key)}
						onmouseenter={() => (hovered = segment.key)}
						onmouseleave={() => (hovered = null)}
						onfocus={() => (hovered = segment.key)}
						onblur={() => (hovered = null)}
					>
						{#if pct >= 12}
							<span class="fiction-split__inline-label">{pct}%</span>
						{/if}
						{#if hovered === segment.key}
							<div class="chart-tooltip" role="tooltip">
								<strong>{count}</strong> book{count === 1 ? '' : 's'} — {segment.label} ({pct}%)
							</div>
						{/if}
					</button>
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
