<script lang="ts">
	import GenreBreakdownChart from '$lib/components/insights/GenreBreakdownChart.svelte';
	import FictionSplitBar from '$lib/components/insights/FictionSplitBar.svelte';
	import YearlyFinishedChart from '$lib/components/insights/YearlyFinishedChart.svelte';
	import MonthlyMetricsPanel from '$lib/components/insights/MonthlyMetricsPanel.svelte';
	import PublicationYearChart from '$lib/components/insights/PublicationYearChart.svelte';
	import MostReadAuthorsList from '$lib/components/insights/MostReadAuthorsList.svelte';
	import PaceStatsPanel from '$lib/components/insights/PaceStatsPanel.svelte';
	import InsightsBooksPanel from '$lib/components/insights/InsightsBooksPanel.svelte';

	let { data } = $props();

	// Clicking a genre/author bar shows its books in the sticky panel to the
	// right instead of navigating away to Profile — there's room for both
	// side by side on a wide screen, and it keeps the charts in view while
	// you look through what makes up a given number.
	let selectedFilter = $state<{ type: 'genre' | 'author'; value: string } | null>(null);

	function selectGenre(genre: string) {
		selectedFilter =
			selectedFilter?.type === 'genre' && selectedFilter.value === genre
				? null
				: { type: 'genre', value: genre };
	}

	function selectAuthor(author: string) {
		selectedFilter =
			selectedFilter?.type === 'author' && selectedFilter.value === author
				? null
				: { type: 'author', value: author };
	}

	let filteredBooks = $derived.by(() => {
		if (!selectedFilter) return [];
		if (selectedFilter.type === 'genre') {
			return data.drillDownBooks.filter((book) => book.genres.includes(selectedFilter!.value));
		}
		return data.drillDownBooks.filter((book) => book.author === selectedFilter!.value);
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
			<YearlyFinishedChart data={data.booksFinishedByYear} />
		</section>

		<section class="dashboard__panel">
			<h2>Genre breakdown</h2>
			<GenreBreakdownChart
				data={data.genreBreakdown}
				selected={selectedFilter?.type === 'genre' ? selectedFilter.value : null}
				onSelect={selectGenre}
			/>
		</section>

		<section class="dashboard__panel">
			<h2>Most-read authors</h2>
			<MostReadAuthorsList
				data={data.mostReadAuthors}
				selected={selectedFilter?.type === 'author' ? selectedFilter.value : null}
				onSelect={selectAuthor}
			/>
		</section>

		<section class="dashboard__panel">
			<h2>Fiction vs. nonfiction</h2>
			<FictionSplitBar split={data.fictionSplit} />
		</section>

		<section class="dashboard__panel">
			<h2>Publication years</h2>
			<PublicationYearChart data={data.publicationYearSpread} />
		</section>

		<section class="dashboard__panel">
			<h2>Last 6 months</h2>
			<MonthlyMetricsPanel data={data.monthlyMetrics} />
		</section>
	</div>

	<InsightsBooksPanel
		filter={selectedFilter}
		books={filteredBooks}
		onClear={() => (selectedFilter = null)}
	/>
</div>
