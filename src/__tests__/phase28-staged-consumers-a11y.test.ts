import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pages = {
  defend: readFileSync(join(process.cwd(), 'docs/defend.html'), 'utf8'),
  operators: readFileSync(join(process.cwd(), 'docs/operators.html'), 'utf8'),
  mission: readFileSync(join(process.cwd(), 'docs/mission.html'), 'utf8'),
  arsenal: readFileSync(join(process.cwd(), 'docs/arsenal.html'), 'utf8'),
  overview: readFileSync(join(process.cwd(), 'docs/overview.html'), 'utf8'),
};

type PageName = keyof typeof pages;

const forms: Array<{
  page: PageName;
  formId: string;
  resultId: string;
  fieldIds: string[];
  submitId: string;
}> = [
  { page: 'defend', formId: 'coverageBind', resultId: 'coverageBindResult', fieldIds: ['coverageFinding', 'coverageArtifact', 'coverageFamily'], submitId: 'coverageBindSubmit' },
  { page: 'defend', formId: 'blackReview', resultId: 'blackReviewResult', fieldIds: ['blackActions', 'blackPaths'], submitId: 'blackReviewSubmit' },
  { page: 'defend', formId: 'whiteStage', resultId: 'whiteStageResult', fieldIds: ['whiteRoe', 'whiteAction', 'whiteTarget'], submitId: 'whiteStageSubmit' },
  { page: 'operators', formId: 'opBlueStage', resultId: 'opBlueStageResult', fieldIds: ['opBlueFinding', 'opBlueArtifact', 'opBlueFamily', 'opBlueBytes'], submitId: 'opBlueStageSubmit' },
  { page: 'operators', formId: 'opBlackReview', resultId: 'opBlackReviewResult', fieldIds: ['opBlackActions', 'opBlackPaths'], submitId: 'opBlackReviewSubmit' },
  { page: 'operators', formId: 'opWhiteStage', resultId: 'opWhiteStageResult', fieldIds: ['opWhiteRoe', 'opWhiteAction', 'opWhiteTarget'], submitId: 'opWhiteStageSubmit' },
  { page: 'mission', formId: 'missionBlackReview', resultId: 'missionBlackReviewResult', fieldIds: ['missionBlackActions', 'missionBlackPaths'], submitId: 'missionBlackReviewSubmit' },
  { page: 'mission', formId: 'missionWhiteStage', resultId: 'missionWhiteStageResult', fieldIds: ['missionWhiteRoe', 'missionWhiteAction', 'missionWhiteTarget'], submitId: 'missionWhiteStageSubmit' },
  { page: 'arsenal', formId: 'arsenalCoverage', resultId: 'arsenalCoverageResult', fieldIds: ['arsenalCoverageFinding', 'arsenalCoverageArtifact', 'arsenalCoverageBytes'], submitId: 'arsenalCoverageSubmit' },
  { page: 'overview', formId: 'overviewStage', resultId: 'overviewStageResult', fieldIds: ['overviewStageHat', 'overviewStageText', 'overviewStageBytes'], submitId: 'overviewStageSubmit' },
];

describe('staged consumer accessibility', () => {
  it('gives every staged control a name, a live region, and a keyboard button', () => {
    for (const form of forms) {
      const html = pages[form.page];
      expect(html, form.page).toContain(`id="${form.formId}"`);
      expect(html, `${form.page} ${form.resultId}`).toContain(`id="${form.resultId}"`);
      expect(html, `${form.page} live`).toContain('role="status"');
      expect(html, `${form.page} polite`).toContain('aria-live="polite"');
      for (const fieldId of form.fieldIds) {
        expect(html, `${form.page} label ${fieldId}`).toContain(`for="${fieldId}"`);
        expect(html, `${form.page} field ${fieldId}`).toContain(`id="${fieldId}"`);
        expect(html, `${form.page} association ${fieldId}`).toContain(`aria-describedby="${form.resultId}"`);
      }
      expect(html, `${form.page} submit`).toContain(`id="${form.submitId}"`);
      expect(html, `${form.page} button`).toContain('type="submit"');
    }
    expect(pages.operators).toContain('id="opBlueStageRetry"');
    expect(pages.operators).toContain('type="button"');
    expect(pages.overview).toContain('Origin POST');
    expect(pages.defend).toContain('href="#content"');
    expect(pages.operators).not.toContain('autofocus');
    expect(pages.mission).not.toContain('autofocus');
    expect(pages.arsenal).not.toContain('autofocus');
  });
});
