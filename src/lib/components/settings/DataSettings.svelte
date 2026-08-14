<script lang="ts">
	import ImportExportSection from './data/ImportExportSection.svelte';
	import BackfillSection from './data/BackfillSection.svelte';
	import ProfileIconSection from './data/ProfileIconSection.svelte';
	import UsernameSection from './data/UsernameSection.svelte';
	import PasswordSection from './data/PasswordSection.svelte';
	import RecoveryKeySection from './data/RecoveryKeySection.svelte';
	import DeleteDataSection from './data/DeleteDataSection.svelte';

	let {
		hasRecoveryKey,
		username,
		avatarEmoji,
		avatarImage,
		onRequestConfirm
	}: {
		hasRecoveryKey: boolean;
		username: string;
		avatarEmoji: string | null;
		avatarImage: string | null;
		onRequestConfirm: (event: MouseEvent, message: string, label?: string, confirmText?: string) => void;
	} = $props();
</script>

<ImportExportSection />
<BackfillSection />
<ProfileIconSection {avatarEmoji} {avatarImage} />
<UsernameSection {username} />
<PasswordSection />
<RecoveryKeySection {hasRecoveryKey} />
<DeleteDataSection {onRequestConfirm} />
