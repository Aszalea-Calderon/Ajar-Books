<script lang="ts">
	import GenreBreakdownChart from '$lib/components/insights/GenreBreakdownChart.svelte';
	import FictionSplitBar from '$lib/components/insights/FictionSplitBar.svelte';
	import YearlyFinishedChart from '$lib/components/insights/YearlyFinishedChart.svelte';
	import MonthlyMetricsPanel from '$lib/components/insights/MonthlyMetricsPanel.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Insights — Ajar Books</title>
</svelte:head>

<div class="insights">
	<h1>Insights</h1>

	<section class="dashboard__panel">
		<h2>Books finished per year</h2>
		<YearlyFinishedChart data={data.booksFinishedByYear} />
	</section>

	<section class="dashboard__panel">
		<h2>Genre breakdown</h2>
		<GenreBreakdownChart data={data.genreBreakdown} />
	</section>

	<section class="dashboard__panel">
		<h2>Fiction vs. nonfiction</h2>
		<FictionSplitBar split={data.fictionSplit} />
	</section>

	<section class="dashboard__panel">
		<h2>Last 6 months</h2>
		<MonthlyMetricsPanel data={data.monthlyMetrics} />
	</section>
</div>
