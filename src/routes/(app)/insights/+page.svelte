<script lang="ts">
	import GenreBreakdownChart from '$lib/components/insights/GenreBreakdownChart.svelte';
	import FictionSplitBar from '$lib/components/insights/FictionSplitBar.svelte';
	import YearlyFinishedChart from '$lib/components/insights/YearlyFinishedChart.svelte';
	import MonthlyMetricsPanel from '$lib/components/insights/MonthlyMetricsPanel.svelte';
	import PublicationYearChart from '$lib/components/insights/PublicationYearChart.svelte';
	import MostReadAuthorsList from '$lib/components/insights/MostReadAuthorsList.svelte';
	import PaceStatsPanel from '$lib/components/insights/PaceStatsPanel.svelte';
	import InsightsBooksPanel from '$lib/components/insights/InsightsBooksPanel.svelte';
	import type { FictionCategory } from '$lib/server/insights/genreClassification';

	let { data } = $props();

	type DrillDownFilter =
		| { type: 'genre'; value: string }
		| { type: 'author'; value: string }
		| { type: 'year'; value: number }
		| { type: 'month'; value: string }
		| { type: 'publicationBucket'; value: string }
		| { type: 'fiction'; value: FictionCategory };

	// Clicking any chart bar shows its books in the sticky panel to the right
	// instead of navigating away to Profile — there's room for both side by
	// side on a wide screen, and it keeps the charts in view while you look
	// through what makes up a given number. Defaults to the current year
	// (not empty) so the panel has something to show the moment the page
	// loads, rather than an inert placeholder.
	let selectedFilter = $state<DrillDownFilter | null>({
		type: 'year',
		value: new Date().getFullYear()
	});

	function toggle(next: DrillDownFilter) {
		const same =
			selectedFilter?.type === next.type &&
			(selectedFilter as { value: unknown }).value === next.value;
		selectedFilter = same ? null : next;
	}

	let filteredBooks = $derived.by(() => {
		const filter = selectedFilter;
		if (!filter) return [];
		switch (filter.type) {
			case 'genre':
				return data.drillDownBooks.filter((book) => book.genres.includes(filter.value));
			case 'author':
				return data.drillDownBooks.filter((book) => book.author === filter.value);
			case 'year':
				return data.drillDownBooks.filter((book) => book.finishedYear === filter.value);
			case 'month':
				return data.drillDownBooks.filter((book) => book.finishedMonth === filter.value);
			case 'publicationBucket':
				return data.drillDownBooks.filter((book) => book.publicationBucket === filter.value);
			case 'fiction':
				return data.drillDownBooks.filter((book) => book.fictionCategory === filter.value);
		}
	});
</script>

<svelte:head>
	<title>Insights — Ajar Books</title>
</svelte:head>

<div class="insights">
	<div class="insights__main">
		<h1>Insights</h1>

		<section class="dashboard__panel">
			<p class="reader-type-summary">{data.readerTypeSummary}</p>
		</section>

		<section class="dashboard__panel">
			<h2>Reading pace</h2>
			<PaceStatsPanel stats={data.paceStats} />
		</section>

		<section class="dashboard__panel">
			<h2>Books finished per year</h2>
			<YearlyFinishedChart
				data={data.booksFinishedByYear}
				selected={selectedFilter?.type === 'year' ? selectedFilter.value : null}
				onSelect={(year) => toggle({ type: 'year', value: year })}
			/>
		</section>

		<section class="dashboard__panel">
			<h2>Genre breakdown</h2>
			<GenreBreakdownChart
				data={data.genreBreakdown}
				selected={selectedFilter?.type === 'genre' ? selectedFilter.value : null}
				onSelect={(genre) => toggle({ type: 'genre', value: genre })}
			/>
		</section>

		<section class="dashboard__panel">
			<h2>Most-read authors</h2>
			<MostReadAuthorsList
				data={data.mostReadAuthors}
				selected={selectedFilter?.type === 'author' ? selectedFilter.value : null}
				onSelect={(author) => toggle({ type: 'author', value: author })}
			/>
		</section>

		<section class="dashboard__panel">
			<h2>Fiction vs. nonfiction</h2>
			<FictionSplitBar
				split={data.fictionSplit}
				selected={selectedFilter?.type === 'fiction' ? selectedFilter.value : null}
				onSelect={(category) => toggle({ type: 'fiction', value: category })}
			/>
		</section>

		<section class="dashboard__panel">
			<h2>Publication years</h2>
			<PublicationYearChart
				data={data.publicationYearSpread}
				selected={selectedFilter?.type === 'publicationBucket' ? selectedFilter.value : null}
				onSelect={(bucket) => toggle({ type: 'publicationBucket', value: bucket })}
			/>
		</section>

		<section class="dashboard__panel">
			<h2>Last 6 months</h2>
			<MonthlyMetricsPanel
				data={data.monthlyMetrics}
				selected={selectedFilter?.type === 'month' ? selectedFilter.value : null}
				onSelect={(month) => toggle({ type: 'month', value: month })}
			/>
		</section>
	</div>

	<InsightsBooksPanel
		filter={selectedFilter}
		books={filteredBooks}
		onClear={() => (selectedFilter = null)}
	/>
</div>
