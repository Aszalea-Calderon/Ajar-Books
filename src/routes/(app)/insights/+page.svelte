<script lang="ts">
	import GenreBreakdownChart from '$lib/components/insights/GenreBreakdownChart.svelte';
	import FictionSplitBar from '$lib/components/insights/FictionSplitBar.svelte';
	import YearlyFinishedChart from '$lib/components/insights/YearlyFinishedChart.svelte';
	import MonthlyMetricsPanel from '$lib/components/insights/MonthlyMetricsPanel.svelte';
	import PublicationYearChart from '$lib/components/insights/PublicationYearChart.svelte';
	import MostReadAuthorsList from '$lib/components/insights/MostReadAuthorsList.svelte';
	import PaceStatsPanel from '$lib/components/insights/PaceStatsPanel.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Insights — Ajar Books</title>
</svelte:head>

<div class="insights">
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
		<GenreBreakdownChart data={data.genreBreakdown} />
	</section>

	<section class="dashboard__panel">
		<h2>Most-read authors</h2>
		<MostReadAuthorsList data={data.mostReadAuthors} />
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
