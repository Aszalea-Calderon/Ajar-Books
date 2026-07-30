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
	import type { ImportRow, ImportSource, ImportStatus } from '$lib/import/types';
	import type { ImportRowResult } from '$lib/server/import/applyImportRow';

	type Step = 'upload' | 'preview' | 'importing' | 'done';

	let step = $state<Step>('upload');
	let fileName = $state('');
	let parseError = $state('');

	let headers = $state<string[]>([]);
	let rawRows = $state<Record<string, string>[]>([]);
	let source = $state<ImportSource>('generic');
	let genericMap = $state<GenericFieldMap>(emptyGenericFieldMap());

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

	async function handleFileChange(event: Event) {
		parseError = '';
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

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

	function backToUpload() {
		step = 'upload';
		headers = [];
		rawRows = [];
		fileName = '';
	}

	// --- Importing ---
	const BATCH_SIZE = 25;
	let importedCount = $state(0);
	let results = $state<ImportRowResult[]>([]);
	let importCancelled = $state(false);

	let addedCount = $derived(results.filter((r) => r.outcome === 'added').length);
	let mergedCount = $derived(results.filter((r) => r.outcome === 'merged').length);
	let errorResults = $derived(results.filter((r) => r.outcome === 'error'));

	async function startImport() {
		step = 'importing';
		importedCount = 0;
		results = [];
		importCancelled = false;

		const toImport = mappedRows.filter((r) => r.title.trim());

		for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
			if (importCancelled) break;
			const batch = toImport.slice(i, i + BATCH_SIZE);
			const response = await fetch(resolve('/(app)/import/batch'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ rows: batch })
			});
			const data = await response.json();
			results = [...results, ...data.results];
			importedCount += batch.length;
		}

		step = 'done';
	}

	function cancelImport() {
		importCancelled = true;
	}

	function startOver() {
		step = 'upload';
		headers = [];
		rawRows = [];
		fileName = '';
		results = [];
		importedCount = 0;
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
			<label class="import-upload__dropzone">
				<input type="file" accept=".csv,text/csv" onchange={handleFileChange} />
				<span>Choose a CSV file to upload</span>
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
				Importing… {importedCount} of {mappedRows.filter((r) => r.title.trim()).length}
			</p>
			<div class="progress-bar__track">
				<div
					class="progress-bar__fill"
					style="width: {(importedCount / Math.max(1, validRowCount)) * 100}%"
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
