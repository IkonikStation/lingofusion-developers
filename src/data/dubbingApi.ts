export type DubbingJob = {
  id?: string;
  project_id?: string;
  language_id?: string;
  status?: string;
  media_url?: string;
  media_type?: string;
};

/** Only status reads are repeated; generating a job is never retried here. */
export async function waitForDubbing(
  initial: DubbingJob,
  readStatus: (projectId: string, languageId: string) => Promise<DubbingJob>,
): Promise<DubbingJob> {
  let job = initial;
  const deadline = Date.now() + 60 * 60 * 1000;
  while (!job.media_url) {
    if (job.status === "failed") throw new Error("Dubbing failed.");
    if (job.status === "completed") throw new Error("Dubbing completed without an audio download.");
    if (!initial.project_id || !initial.language_id) throw new Error("The dubbing service did not return a job reference.");
    if (Date.now() >= deadline) throw new Error("Dubbing is still processing. Check your ElevenLabs project before starting another job.");
    await new Promise(resolve => setTimeout(resolve, 5000));
    job = { ...initial, ...await readStatus(initial.project_id, initial.language_id) };
  }
  return job;
}
