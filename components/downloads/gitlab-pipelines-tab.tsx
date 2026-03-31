"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { createArtifactProfilePreview } from "@/lib/downloads";
import {
  useAssetMatcher,
  getArchLabel,
  getPlatformLabel,
} from "@/hooks/downloads/use-asset-matcher";
import { selectableCheckboxRowClass, SelectableCardButton } from "./selectable-list-patterns";
import type { GitLabPipelineInfo, GitLabJobInfo } from "@/types/gitlab";

interface GitLabPipelinesTabProps {
  pipelines: GitLabPipelineInfo[];
  selectedPipelineId: number | null;
  onSelectPipeline: (pipelineId: number) => void;
  jobs: GitLabJobInfo[];
  selectedJobs: GitLabJobInfo[];
  onToggleJob: (job: GitLabJobInfo) => void;
  jobsLoading: boolean;
  onRefresh: () => Promise<unknown>;
  t: (key: string) => string;
}

export function GitLabPipelinesTab({
  pipelines,
  selectedPipelineId,
  onSelectPipeline,
  jobs,
  selectedJobs,
  onToggleJob,
  jobsLoading,
  onRefresh,
  t,
}: GitLabPipelinesTabProps) {
  const { currentPlatform, currentArch } = useAssetMatcher();

  return (
    <>
      <div className="flex items-center justify-between">
        <Label>{t("downloads.gitlab.pipelines")}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await onRefresh();
            } catch {
              // Error handled by caller
            }
          }}
        >
          {t("common.refresh")}
        </Button>
      </div>

      <ScrollArea className="h-35 border rounded-md">
        {pipelines.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("downloads.gitlab.noPipelines")}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {pipelines.map((pipeline) => (
              <SelectableCardButton
                key={pipeline.id}
                selected={selectedPipelineId === pipeline.id}
                onClick={() => onSelectPipeline(pipeline.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">#{pipeline.id}</span>
                  <Badge variant="outline" className="text-xs">
                    {pipeline.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {pipeline.refName || "—"}
                </div>
              </SelectableCardButton>
            ))}
          </div>
        )}
      </ScrollArea>

      <Label>{t("downloads.gitlab.jobs")}</Label>
      <ScrollArea className="h-40 border rounded-md">
        {jobsLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !selectedPipelineId ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("downloads.gitlab.selectPipeline")}
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("downloads.gitlab.noJobs")}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {jobs.map((job) => {
              const checked = selectedJobs.some((j) => j.id === job.id);
              const profile = createArtifactProfilePreview({
                fileName: `${job.name}.zip`,
                sourceKind: "gitlab_pipeline_artifact",
              });
              const isRecommended =
                job.hasArtifacts &&
                currentPlatform !== "unknown" &&
                currentArch !== "unknown" &&
                profile.platform === currentPlatform &&
                profile.arch === currentArch;
              return (
                <label
                  key={job.id}
                  className={selectableCheckboxRowClass({
                    selected: checked || isRecommended,
                    tone: isRecommended ? "success" : "default",
                    disabled: !job.hasArtifacts,
                  })}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!job.hasArtifacts}
                    onCheckedChange={() => onToggleJob(job)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{job.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {job.stage || "—"} · {job.status}
                    </div>
                  </div>
                  <Badge
                    variant={job.hasArtifacts ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {job.hasArtifacts
                      ? t("downloads.gitlab.downloadArtifacts")
                      : t("common.none")}
                  </Badge>
                  {job.hasArtifacts && (
                    <Badge variant="outline" className="text-xs">
                      {t(`downloads.artifactKind.${profile.artifactKind}`)}
                    </Badge>
                  )}
                  {job.hasArtifacts && profile.platform !== "unknown" && (
                    <Badge variant="outline" className="text-xs">
                      {profile.platform === "universal"
                        ? getArchLabel("universal")
                        : getPlatformLabel(profile.platform)}
                    </Badge>
                  )}
                  {job.hasArtifacts && profile.arch !== "unknown" && (
                    <Badge variant="secondary" className="text-xs">
                      {getArchLabel(profile.arch)}
                    </Badge>
                  )}
                  {isRecommended && (
                    <Badge variant="secondary" className="text-xs">
                      {t("downloads.gitlab.recommended")}
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </>
  );
}
