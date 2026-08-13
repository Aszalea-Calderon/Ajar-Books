import type { PageServerLoad } from './$types';
import { getLatestImportJob } from '$lib/server/import/job';

export const load: PageServerLoad = async () => {
	return { latestJob: await getLatestImportJob() };
};
