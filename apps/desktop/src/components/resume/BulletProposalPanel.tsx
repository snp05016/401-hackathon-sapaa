import type { BulletProposal } from "@ghostboard/resume";
import { AlertTriangle, Check, Sparkles, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";

export interface BulletProposalPanelProps {
  proposals: BulletProposal[];
  requested: boolean;
  canRequest: boolean;
  warnings: string[];
  loading: boolean;
  error: string | null;
  applying: boolean;
  applyError: string | null;
  acceptedIds: ReadonlySet<string>;
  rejectedIds: ReadonlySet<string>;
  onRequest: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onApply: () => void;
}

/**
 * Plain-text review surface for surgical bullet suggestions. It deliberately
 * never renders the master source or a LaTeX editor: the user reviews prose,
 * chooses each replacement independently, and then creates a separate draft.
 */
export function BulletProposalPanel({
  proposals,
  requested,
  canRequest,
  warnings,
  loading,
  error,
  applying,
  applyError,
  acceptedIds,
  rejectedIds,
  onRequest,
  onAccept,
  onReject,
  onApply,
}: BulletProposalPanelProps) {
  return (
    <Card className="mt-6" aria-labelledby="bullet-proposals-heading">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={15} aria-hidden="true" className="text-oxblood" />
              <h3 id="bullet-proposals-heading" className="font-display text-[20px] text-ink">
                Surgical bullet edits
              </h3>
            </div>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-ink-2">
              Get focused suggestions from your master resume and experience bank. Review each line before creating a tailored draft.
            </p>
          </div>
          <Button variant="outline" silent onClick={onRequest} disabled={loading || !canRequest} aria-describedby="bullet-proposals-help">
            {loading ? "Finding edits…" : "Suggest bullet edits"}
          </Button>
        </div>
        <p id="bullet-proposals-help" className="mt-2 text-[11px] text-ink-3">
          Nothing changes until you accept a suggestion and apply the selected edits.
        </p>
      </CardHeader>
      <CardContent>
        {loading && (
          <p role="status" className="pulse-soft border-l-2 border-oxblood pl-3 text-[12px] text-ink-2">
            Comparing the job description with your resume evidence…
          </p>
        )}

        {error && (
          <p role="alert" className="border-l-2 border-oxblood pl-3 text-[12px] leading-relaxed text-oxblood">
            {error}
          </p>
        )}

        {applyError && (
          <p role="alert" className="mt-3 border-l-2 border-oxblood pl-3 text-[12px] leading-relaxed text-oxblood">
            {applyError}
          </p>
        )}

        {warnings.length > 0 && (
          <div role="status" className="mt-3 border-l-2 border-brass pl-3 text-[12px] leading-relaxed text-ink-2">
            <p className="flex items-center gap-1.5 font-medium text-brass">
              <AlertTriangle size={13} aria-hidden="true" />
              Review warnings
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
            </ul>
          </div>
        )}

        {requested && !loading && !error && proposals.length === 0 && (
          <p className="text-[12px] leading-relaxed text-ink-2">
            No focused edits are waiting. Try again after choosing a job description with clear requirements.
          </p>
        )}

        {proposals.length > 0 && (
          <>
            <ul className="space-y-4" aria-label="Resume bullet proposals">
              {proposals.map((proposal) => {
                const accepted = acceptedIds.has(proposal.id);
                const rejected = rejectedIds.has(proposal.id);
                return (
                  <li
                    key={proposal.id}
                    className={`rounded-md border p-4 transition-colors ${accepted ? "border-verdigris/50 bg-verdigris/5" : rejected ? "border-hairline bg-paper/70 opacity-75" : "border-hairline bg-paper"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={rejected ? "mist" : proposal.unsupported ? "warning" : "verdigris"}>
                          {rejected ? "Rejected" : proposal.unsupported ? "Needs evidence review" : "Supported"}
                        </Badge>
                        {proposal.replacementSource === "experience-bank" && <Badge variant="outline">Experience bank</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={accepted ? "ink" : "outline"}
                          silent
                          className="px-2.5 py-1.5 text-[12px]"
                          aria-pressed={accepted}
                          aria-label={`${accepted ? "Accepted" : "Accept"} suggested edit`}
                          onClick={() => onAccept(proposal.id)}
                        >
                          <Check size={13} aria-hidden="true" />
                          {accepted ? "Accepted" : "Accept"}
                        </Button>
                        <Button
                          type="button"
                          variant={rejected ? "ink" : "outline"}
                          silent
                          className="px-2.5 py-1.5 text-[12px]"
                          aria-pressed={rejected}
                          aria-label={`${rejected ? "Rejected" : "Reject"} suggested edit`}
                          onClick={() => onReject(proposal.id)}
                        >
                          <X size={13} aria-hidden="true" />
                          Reject
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">Current bullet</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{proposal.before}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">Suggested bullet</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink">{proposal.after}</p>
                      </div>
                    </div>
                    {proposal.rationale && <p className="mt-3 text-[11px] italic leading-relaxed text-ink-2">Why: {proposal.rationale}</p>}
                    {proposal.evidence.length > 0 && (
                      <div className="mt-3 border-t border-hairline pt-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">Evidence used</p>
                        <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-ink-2">
                          {proposal.evidence.map((evidence) => (
                            <li key={evidence.ref}>
                              <span className="font-medium text-ink">{evidence.role} · {evidence.employer}:</span>{" "}
                              {evidence.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {proposal.unsupported && (
                      <p className="mt-3 text-[11px] leading-relaxed text-brass">
                        This suggestion introduces a named capability not supported by the current bullet or cited evidence. Accept only after checking it yourself.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
              <Button
                variant="ink"
                silent
                onClick={onApply}
                disabled={applying || acceptedIds.size === 0}
              >
                {applying ? "Preparing tailored draft…" : `Apply ${acceptedIds.size || "accepted"} edit${acceptedIds.size === 1 ? "" : "s"} to draft`}
              </Button>
              <p className="text-[11px] text-ink-3">
                The master resume stays byte-identical.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
