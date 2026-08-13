<script lang="ts">
	import { resolve } from '$app/paths';
	import { parseCsv } from '$lib/import/csv';
	import { detectSource } from '$lib/import/detect';
	import { mapRow } from '$lib/import/mapRow';
	import {
		emptyGenericFieldMap,
		guessGenericFieldMap,
		type GenericFieldMap
	} from '$lib/import/generic';
	import { onDestroy, onMount } from 'svelte';
	import type { ImportRow, ImportSource, ImportStatus } from '$lib/import/types';
	import type { ImportRowResult } from '$lib/server/import/applyImportRow';
	import type { ImportJob } from '$lib/server/import/job';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Step = 'upload' | 'preview' | 'importing' | 'done';

	let step = $state<Step>('upload');
	let fileName = $state('');
	let parseError = $state('');

	let headers = $state<string[]>([]);
	let rawRows = $state<Record<string, string>[]>([]);
	let source = $state<ImportSource>('generic');
	let genericMap = $state<GenericFieldMap>(emptyGenericFieldMap());
	let isDraggingOver = $state(false);

	const SOURCE_LABELS: Record<ImportSource, string> = {
		goodreads: 'Goodreads',
		storygraph: 'StoryGraph',
		generic: 'Other / Generic CSV'
	};

	const STATUS_OPTIONS: { value: ImportStatus; label: string }[] = [
		{ value: 'want_to_read', label: 'Want to Read' },
		{ value: 'reading', label: 'Currently Reading' },
		{ value: 'finished', label: 'Finished' },
		{ value: 'dnf', label: 'Did Not Finish' }
	];

	// Recomputed whenever the source or (for generic) the column mapping
	// changes — this is what both the preview table and the actual import
	// batches are built from.
	let mappedRows = $derived.by((): ImportRow[] => {
		try {
			return rawRows.map((row) => mapRow(source, row, genericMap));
		} catch {
			return [];
		}
	});

	let validRowCount = $derived(mappedRows.filter((r) => r.title.trim()).length);

	async function loadFile(file: File) {
		parseError = '';
		fileName = file.name;
		const text = await file.text();
		const parsed = parseCsv(text);

		if (parsed.headers.length === 0 || parsed.rows.length === 0) {
			parseError = "Couldn't find any rows in that file — is it a real CSV export?";
			return;
		}

		headers = parsed.headers;
		rawRows = parsed.rows;
		source = detectSource(headers);
		genericMap = source === 'generic' ? guessGenericFieldMap(headers) : emptyGenericFieldMap();
		step = 'preview';
	}

	function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) loadFile(file);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDraggingOver = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) loadFile(file);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDraggingOver = true;
	}

	function backToUpload() {
		step = 'upload';
		headers = [];
		rawRows = [];
		fileName = '';
	}

	// --- Importing ---
	// Driven server-side (see $lib/server/import/job.ts) so it keeps going
	// even if this tab closes or the computer sleeps — this page's only job
	// is to kick it off and poll for progress, including right after
	// mounting if one was already running (see onMount below).
	const POLL_MS = 800;
	let jobId = $state<string | null>(null);
	let jobTotal = $state(0);
	let importedCount = $state(0);
	let results = $state<ImportRowResult[]>([]);
	let pollHandle: ReturnType<typeof setInterval> | undefined;

	let addedCount = $derived(results.filter((r) => r.outcome === 'added').length);
	let mergedCount = $derived(results.filter((r) => r.outcome === 'merged').length);
	let errorResults = $derived(results.filter((r) => r.outcome === 'error'));

	function applyJobState(job: ImportJob) {
		jobId = job.id;
		jobTotal = job.total;
		importedCount = job.processed;
		results = job.results;
		if (job.status === 'running' || job.status === 'stopping') {
			step = 'importing';
			startPolling(job.id);
		} else {
			step = 'done';
			stopPolling();
		}
	}

	function startPolling(id: string) {
		stopPolling();
		pollHandle = setInterval(async () => {
			const res = await fetch(resolve('/(app)/import/jobs/[id]', { id }));
			if (!res.ok) return;
			const job: ImportJob = await res.json();
			applyJobState(job);
		}, POLL_MS);
	}

	function stopPolling() {
		if (pollHandle) clearInterval(pollHandle);
		pollHandle = undefined;
	}

	onMount(() => {
		if (data.latestJob) applyJobState(data.latestJob);
	});
	onDestroy(stopPolling);

	async function startImport() {
		const toImport = mappedRows.filter((r) => r.title.trim());
		step = 'importing';
		importedCount = 0;
		jobTotal = toImport.length;
		results = [];

		const response = await fetch(resolve('/(app)/import/jobs'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ rows: toImport })
		});
		const { jobId: newJobId } = await response.json();
		jobId = newJobId;
		startPolling(newJobId);
	}

	async function cancelImport() {
		if (!jobId) return;
		await fetch(resolve('/(app)/import/jobs/[id]/stop', { id: jobId }), { method: 'POST' });
	}

	async function startOver() {
		// Explicit dismissal — otherwise getLatestImportJob would keep
		// surfacing these finished results on every future visit to /import.
		if (jobId) await fetch(resolve('/(app)/import/jobs/[id]', { id: jobId }), { method: 'DELETE' });
		step = 'upload';
		headers = [];
		rawRows = [];
		fileName = '';
		results = [];
		importedCount = 0;
		jobId = null;
		stopPolling();
	}
</script>

<svelte:head>
	<title>Import — Ajar Books</title>
</svelte:head>

<div class="import-page">
	<h2>Import your library</h2>
	<p class="import-page__hint">
		Bring in a CSV export from Goodreads or StoryGraph — books already in your library (matched by
		ISBN, or title/author if there's no ISBN) get merged rather than duplicated.
	</p>

	{#if step === 'upload'}
		<div class="import-upload">
			<label
				class="import-upload__dropzone"
				class:import-upload__dropzone--active={isDraggingOver}
				ondragover={handleDragOver}
				ondragleave={() => (isDraggingOver = false)}
				ondrop={handleDrop}
			>
				<input type="file" accept=".csv,text/csv" onchange={handleFileChange} />
				<span>{isDraggingOver ? 'Drop it' : 'Choose a CSV file, or drag one here'}</span>
			</label>
			{#if parseError}
				<p class="dashboard__empty">{parseError}</p>
			{/if}
		</div>
	{:else if step === 'preview'}
		<div class="import-preview">
			<p class="import-preview__file">
				<strong>{fileName}</strong> — {rawRows.length} row{rawRows.length === 1 ? '' : 's'} found
				<button type="button" class="settings-trigger" onclick={backToUpload}
					>Choose a different file</button
				>
			</p>

			<div class="import-preview__source">
				<span class="filter-button__group-label">Detected format</span>
				<div class="pill-row">
					{#each Object.entries(SOURCE_LABELS) as [value, label] (value)}
						<button
							type="button"
							class="status-control__pill"
							class:status-control__pill--active={source === value}
							onclick={() => (source = value as ImportSource)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			{#if source === 'generic'}
				<div class="import-preview__mapping">
					<p class="settings-hint">
						We don't recognize this format's columns — point each field at the matching column from
						your file. Every row will be imported with the same status below (you can change
						individual books afterward).
					</p>
					<div class="import-mapping-grid">
						{#each [['title', 'Title'], ['author', 'Author'], ['isbn', 'ISBN'], ['pageCount', 'Page count'], ['publicationYear', 'Publication year'], ['rating', 'Rating'], ['genres', 'Genres (comma-separated)']] as [field, label] (field)}
							<label class="import-mapping-grid__row">
								<span>{label}</span>
								<select bind:value={genericMap[field as keyof GenericFieldMap]}>
									<option value={null}>— Not in file —</option>
									{#each headers as header (header)}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</label>
						{/each}
						<label class="import-mapping-grid__row">
							<span>Import all rows as</span>
							<select bind:value={genericMap.defaultStatus}>
								{#each STATUS_OPTIONS as opt (opt.value)}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</label>
					</div>
				</div>
			{/if}

			<h3>Preview</h3>
			<p class="settings-hint">First 10 of {validRowCount} importable rows.</p>
			<div class="data-table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th></th>
							<th>Title</th>
							<th>Author</th>
							<th>Status</th>
							<th>Rating</th>
							<th>Genres</th>
						</tr>
					</thead>
					<tbody>
						{#each mappedRows
							.filter((r) => r.title.trim())
							.slice(0, 10) as row (row.title + (row.isbn ?? ''))}
							<tr>
								<td></td>
								<td>{row.title}</td>
								<td>{row.author ?? '—'}</td>
								<td>{row.status ?? '—'}</td>
								<td>{row.rating ?? '—'}</td>
								<td>{row.genres.join(', ') || '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="import-preview__actions">
				<button
					type="button"
					class="search-bar__submit"
					disabled={validRowCount === 0}
					onclick={startImport}
				>
					Import {validRowCount} book{validRowCount === 1 ? '' : 's'}
				</button>
			</div>
		</div>
	{:else if step === 'importing'}
		<div class="import-progress">
			<p>
				Importing… {importedCount} of {jobTotal}
			</p>
			<div class="progress-bar__track">
				<div
					class="progress-bar__fill"
					style="width: {(importedCount / Math.max(1, jobTotal)) * 100}%"
				></div>
			</div>
			<button type="button" class="settings-trigger" onclick={cancelImport}>Stop</button>
		</div>
	{:else if step === 'done'}
		<div class="import-results">
			<h3>Import complete</h3>
			<p class="settings-hint">
				{addedCount} added, {mergedCount} merged into books already in your library{#if errorResults.length},
					{errorResults.length} skipped{/if}.
			</p>
			{#if errorResults.length > 0}
				<h4>Skipped rows</h4>
				<ul class="import-results__errors">
					{#each errorResults as result (result.title)}
						<li><strong>{result.title}</strong> — {result.message}</li>
					{/each}
				</ul>
			{/if}
			<div class="import-preview__actions">
				<a class="search-bar__submit" href={resolve('/profile')}>Go to My Library</a>
				<button type="button" class="settings-trigger" onclick={startOver}
					>Import another file</button
				>
			</div>
		</div>
	{/if}
</div>
