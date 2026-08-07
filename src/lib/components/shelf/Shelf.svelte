<script lang="ts">
	import { T } from '@threlte/core';

	let { y, width }: { y: number; width: number } = $props();
</script>

<T.Mesh position.x={0} position.y={y} position.z={-0.03}>
	<T.BoxGeometry args={[width, 0.02, 0.32]} />
	<T.MeshStandardMaterial color="#2a2015" roughness={0.9} />
</T.Mesh>
