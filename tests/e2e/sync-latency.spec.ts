import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { SyncLatencyEvent } from "@/lib/sync/sync-latency-spike";
import { SYNC_LATENCY_SPIKE_STORAGE_KEY } from "@/lib/sync/sync-latency-spike";
import { getVisibleListCard } from "./utils/assertions";
import { renameList } from "./utils/app";
import {
  joinTrialEvents,
  renderBurstResultsMarkdown,
  renderResultsMarkdown,
  summarize,
  summarizeValues,
  type SyncLatencyTrialMetrics,
} from "./utils/sync-latency-metrics";
import {
  authStoragePathForIndex,
  gotoDashboard,
  resolveE2eUserPool,
} from "./utils/seed";
import {
  cleanupSharedList,
  seedSharedList,
} from "./utils/sync-latency-seed";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const scenarioNames = ["baseline", "moderate", "burst"] as const;
type ScenarioName = (typeof scenarioNames)[number];
type ScenarioSelection = ScenarioName | "all";

const scenarioSelection = readScenarioSelection();
const selectedScenarios: ScenarioName[] =
  scenarioSelection === "all" ? [...scenarioNames] : [scenarioSelection];
const measuredTrials = readCount("SYNC_LATENCY_TRIALS", 30, false);
const warmupTrials = readCount("SYNC_LATENCY_WARMUP", 5, true);
const burstCadenceMs = readCount("SYNC_LATENCY_BURST_CADENCE_MS", 5_000, true);
const perTrialTimeoutMs = 15_000;
const burstRenameCount = 10;
const usesModerateWorkspace = selectedScenarios.some(
  (scenario) => scenario === "moderate" || scenario === "burst",
);
const workspaceShape = usesModerateWorkspace
  ? { listCount: 10, itemsPerWorkspace: 200 }
  : { listCount: 5, itemsPerWorkspace: 50 };
const artifactDirectory = path.resolve(".tidy-ai", "sync-latency");
const spikeReportPath = path.resolve(
  "docs",
  "spikes",
  "3.1.0-sync-latency-measurement.md",
);
const reportMarkers: Record<
  ScenarioName,
  { start: string; end: string }
> = {
  baseline: {
    start: "<!-- SYNC_LATENCY_RESULTS:BASELINE:START -->",
    end: "<!-- SYNC_LATENCY_RESULTS:BASELINE:END -->",
  },
  moderate: {
    start: "<!-- SYNC_LATENCY_RESULTS:MODERATE:START -->",
    end: "<!-- SYNC_LATENCY_RESULTS:MODERATE:END -->",
  },
  burst: {
    start: "<!-- SYNC_LATENCY_RESULTS:BURST:START -->",
    end: "<!-- SYNC_LATENCY_RESULTS:BURST:END -->",
  },
};

type SeededList = Awaited<ReturnType<typeof seedSharedList>>;

type TrialRun = {
  trialId: string;
  warmup: boolean;
  startedAtWallClockMs: number;
  marker?: string;
  rendered: boolean;
  failure?: string;
  ownerEvents: SyncLatencyEvent[];
  peerEvents: SyncLatencyEvent[];
  joined: SyncLatencyTrialMetrics;
};

type BurstRun = {
  burstId: string;
  warmup: boolean;
  configuredCadenceMs: number;
  actualStartCadenceMs: number[];
  renames: TrialRun[];
  finalMarkerRenderMs?: number;
};

function readScenarioSelection(): ScenarioSelection {
  const value = process.env.SYNC_LATENCY_SCENARIO ?? "all";
  if (value === "all" || scenarioNames.includes(value as ScenarioName)) {
    return value as ScenarioSelection;
  }
  throw new Error(
    "SYNC_LATENCY_SCENARIO must be baseline, moderate, burst, or all.",
  );
}

function readCount(name: string, fallback: number, allowZero: boolean) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function startTrial(page: Page, trialId: string) {
  return page.evaluate((id) => {
    const api = window.__tidySyncLatency;
    if (!api) {
      throw new Error(
        "Sync-latency instrumentation is unavailable. The localStorage gate " +
        "must be armed before dashboard navigation.",
      );
    }
    api.clear();
    return api.startTrial(id);
  }, trialId);
}

async function readEvents(page: Page) {
  return page
    .evaluate(() => [...(window.__tidySyncLatency?.events() ?? [])])
    .catch(() => [] as SyncLatencyEvent[]);
}

async function stopTrial(page: Page) {
  await page.evaluate(() => window.__tidySyncLatency?.stopTrial()).catch(() => {});
}

async function waitForPeerRender(page: Page, trialId: string) {
  return page
    .waitForFunction(
      (id) =>
        window.__tidySyncLatency
          ?.events()
          .some((event) => event.trialId === id && event.stage === "peer_render"),
      trialId,
      { timeout: perTrialTimeoutMs },
    )
    .then(() => true)
    .catch(() => false);
}

function firstStageWallClock(
  events: ReadonlyArray<SyncLatencyEvent>,
  stage: SyncLatencyEvent["stage"],
) {
  return events
    .filter((event) => event.stage === stage)
    .sort((left, right) => left.wallClockMs - right.wallClockMs)[0]
    ?.wallClockMs;
}

function writeArtifact(scenario: ScenarioName, payload: object) {
  mkdirSync(artifactDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactPath = path.join(
    artifactDirectory,
    `${scenario}-${timestamp}.json`,
  );
  writeFileSync(
    artifactPath,
    `${JSON.stringify({ scenario, workspaceShape, ...payload }, null, 2)}\n`,
    "utf8",
  );
  return artifactPath;
}

function writeScenarioReport(scenario: ScenarioName, markdown: string) {
  const report = readFileSync(spikeReportPath, "utf8");
  const markers = reportMarkers[scenario];
  const start = report.indexOf(markers.start);
  const end = report.indexOf(markers.end);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `${scenario} sync-latency report markers are missing or out of order.`,
    );
  }

  const before = report.slice(0, start + markers.start.length);
  const after = report.slice(end);
  const newline = report.includes("\r\n") ? "\r\n" : "\n";
  const normalizedMarkdown = markdown.replace(/\n/g, newline);
  writeFileSync(
    spikeReportPath,
    `${before}${newline}${normalizedMarkdown}${newline}${after}`,
    "utf8",
  );
}

const renameOperationCount = selectedScenarios.reduce(
  (total, scenario) =>
    total +
    (measuredTrials + warmupTrials) *
      (scenario === "burst" ? burstRenameCount : 1),
  0,
);

test.describe("two-user sync latency", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(renameOperationCount * 20_000 + 120_000);

  let ownerContext: BrowserContext | undefined;
  let editorContext: BrowserContext | undefined;
  let ownerPage: Page | undefined;
  let editorPage: Page | undefined;
  let seededList: SeededList | undefined;

  test.beforeAll(async ({ browser }) => {
    const storageFiles = [
      authStoragePathForIndex(0),
      authStoragePathForIndex(1),
    ];
    for (const file of storageFiles) {
      if (!existsSync(file)) {
        throw new Error(
          `Missing auth storage ${file}. Run npm run test:e2e:auth:setup first.`,
        );
      }
    }

    const userPool = resolveE2eUserPool();
    if (userPool.length < 2) {
      throw new Error(
        "Sync-latency measurement requires E2E_TEST_EMAIL_1/PASSWORD_1 and " +
        "E2E_TEST_EMAIL_2/PASSWORD_2, then npm run test:e2e:auth:setup.",
      );
    }

    seededList = await seedSharedList({
      ownerEmail: userPool[0].email,
      editorEmail: userPool[1].email,
      ...workspaceShape,
    });

    ownerContext = await browser.newContext({ storageState: storageFiles[0] });
    editorContext = await browser.newContext({ storageState: storageFiles[1] });
    for (const context of [ownerContext, editorContext]) {
      await context.addInitScript((storageKey) => {
        try {
          localStorage.setItem(storageKey, "1");
        } catch {
          // about:blank has an opaque origin; the script runs again on navigation.
        }
      }, SYNC_LATENCY_SPIKE_STORAGE_KEY);
    }

    ownerPage = await ownerContext.newPage();
    editorPage = await editorContext.newPage();
    await gotoDashboard(ownerPage);
    await gotoDashboard(editorPage);

    await expect(await getVisibleListCard(ownerPage, seededList.listName)).toBeVisible({
      timeout: 15_000,
    });
    await expect(await getVisibleListCard(editorPage, seededList.listName)).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(async () => editorPage?.evaluate(() => window.__tidySyncLatency?.enabled))
      .toBe(true);
  });

  test.afterAll(async () => {
    await Promise.allSettled([
      ownerContext?.close() ?? Promise.resolve(),
      editorContext?.close() ?? Promise.resolve(),
    ]);
    if (seededList) await cleanupSharedList(seededList.seededListIds);
  });

  test("measures selected shared-list propagation scenarios", async () => {
    if (!ownerPage || !editorPage || !seededList) {
      throw new Error("Sync-latency harness did not initialize.");
    }

    const activeOwnerPage = ownerPage;
    const activeEditorPage = editorPage;
    let currentListName = seededList.listName;

    const runRenameTrial = async (
      trialId: string,
      warmup: boolean,
    ): Promise<TrialRun> => {
      const startedAtWallClockMs = Date.now();
      let marker: string | undefined;
      let rendered = false;
      let failure: string | undefined;

      try {
        const editorTrial = await startTrial(activeEditorPage, trialId);
        const ownerTrial = await startTrial(activeOwnerPage, trialId);
        expect(ownerTrial.marker).toBe(editorTrial.marker);
        marker = ownerTrial.marker;

        await renameList(activeOwnerPage, currentListName, marker);
        currentListName = marker;
        rendered = await waitForPeerRender(activeEditorPage, trialId);
        if (!rendered) {
          failure = `No peer_render event within ${perTrialTimeoutMs} ms.`;
        }
      } catch (error) {
        failure = errorMessage(error);
      }

      const [ownerEvents, peerEvents] = await Promise.all([
        readEvents(activeOwnerPage),
        readEvents(activeEditorPage),
      ]);
      await Promise.all([
        stopTrial(activeOwnerPage),
        stopTrial(activeEditorPage),
      ]);
      const joined = joinTrialEvents(ownerEvents, peerEvents).find(
        (trial) => trial.trialId === trialId,
      ) ?? { trialId, metrics: {} };

      return {
        trialId,
        warmup,
        startedAtWallClockMs,
        marker,
        rendered,
        failure,
        ownerEvents,
        peerEvents,
        joined,
      };
    };

    const runSingleRenameScenario = async (scenario: "baseline" | "moderate") => {
      const runs: TrialRun[] = [];
      const totalTrials = warmupTrials + measuredTrials;
      for (let index = 0; index < totalTrials; index += 1) {
        const warmup = index < warmupTrials;
        const sequence = warmup ? index + 1 : index - warmupTrials + 1;
        const trialId = warmup
          ? `${scenario}-warmup-${String(sequence).padStart(3, "0")}`
          : `${scenario}-${String(sequence).padStart(3, "0")}`;
        runs.push(await runRenameTrial(trialId, warmup));
      }

      const measured = runs
        .filter((run) => !run.warmup)
        .map((run) => run.joined);
      const summary = summarize(measured);
      const markdown = renderResultsMarkdown(summary);
      const artifactPath = writeArtifact(scenario, {
        measuredTrials,
        warmupTrials,
        runs,
        summary,
      });

      console.log(`Sync-latency artifact: ${artifactPath}`);
      console.log(markdown);
      expect(summary.endToEnd.validN).toBeGreaterThan(0);
      expect(summary.endToEnd.failures / measuredTrials).toBeLessThan(0.8);
      if (process.env.SYNC_LATENCY_WRITE_REPORT === "1") {
        writeScenarioReport(scenario, markdown);
      }
    };

    const runBurstScenario = async () => {
      const bursts: BurstRun[] = [];
      const totalBursts = warmupTrials + measuredTrials;
      for (let index = 0; index < totalBursts; index += 1) {
        const warmup = index < warmupTrials;
        const sequence = warmup ? index + 1 : index - warmupTrials + 1;
        const burstId = warmup
          ? `burst-warmup-${String(sequence).padStart(3, "0")}`
          : `burst-${String(sequence).padStart(3, "0")}`;
        const renames: TrialRun[] = [];

        for (let renameIndex = 0; renameIndex < burstRenameCount; renameIndex += 1) {
          const cadenceStart = Date.now();
          const trialId = `${burstId}-r${String(renameIndex + 1).padStart(2, "0")}`;
          renames.push(await runRenameTrial(trialId, warmup));
          if (renameIndex < burstRenameCount - 1) {
            await delay(Math.max(0, burstCadenceMs - (Date.now() - cadenceStart)));
          }
        }

        const firstLocalMutation = firstStageWallClock(
          renames[0]?.ownerEvents ?? [],
          "local_mutation",
        );
        const finalPeerRender = firstStageWallClock(
          renames.at(-1)?.peerEvents ?? [],
          "peer_render",
        );
        const finalMarkerRenderMs =
          firstLocalMutation !== undefined && finalPeerRender !== undefined
            ? finalPeerRender - firstLocalMutation
            : undefined;
        const actualStartCadenceMs = renames.slice(1).map(
          (rename, renameIndex) =>
            rename.startedAtWallClockMs -
            renames[renameIndex].startedAtWallClockMs,
        );
        bursts.push({
          burstId,
          warmup,
          configuredCadenceMs: burstCadenceMs,
          actualStartCadenceMs,
          renames,
          finalMarkerRenderMs,
        });
      }

      const measuredBursts = bursts.filter((burst) => !burst.warmup);
      const measuredRenames = measuredBursts.flatMap((burst) =>
        burst.renames.map((rename) => rename.joined),
      );
      const individualEndToEnd = summarize(measuredRenames).endToEnd;
      const finalMarkerValues = measuredBursts
        .map((burst) => burst.finalMarkerRenderMs)
        .filter((value): value is number => value !== undefined);
      const finalMarkerRender = summarizeValues(
        finalMarkerValues,
        measuredTrials,
      );
      const markdown = renderBurstResultsMarkdown({
        individualEndToEnd,
        finalMarkerRender,
      });
      const artifactPath = writeArtifact("burst", {
        measuredBursts: measuredTrials,
        warmupBursts: warmupTrials,
        burstRenameCount,
        configuredCadenceMs: burstCadenceMs,
        bursts,
        summary: { individualEndToEnd, finalMarkerRender },
      });

      console.log(`Sync-latency artifact: ${artifactPath}`);
      console.log(markdown);
      expect(individualEndToEnd.validN).toBeGreaterThan(0);
      expect(
        individualEndToEnd.failures / (measuredTrials * burstRenameCount),
      ).toBeLessThan(0.8);
      expect(finalMarkerRender.validN).toBeGreaterThan(0);
      expect(finalMarkerRender.failures / measuredTrials).toBeLessThan(0.8);
      if (process.env.SYNC_LATENCY_WRITE_REPORT === "1") {
        writeScenarioReport("burst", markdown);
      }
    };

    for (const scenario of selectedScenarios) {
      if (scenario === "burst") {
        await runBurstScenario();
      } else {
        await runSingleRenameScenario(scenario);
      }
    }
  });
});
