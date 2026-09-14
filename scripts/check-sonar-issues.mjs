import { readFile, appendFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SONAR = 'https://sonarcloud.io';
const requireValue = (condition, message) => {
    if (!condition) throw new Error(message);
};
const escapeCell = (value) =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('|', '&#124;')
        .replaceAll('\n', ' ');

export async function checkSonarIssues(
    { token, githubToken, repository, pullRequest, revision, metadata, project },
    request = fetch,
) {
    requireValue(
        token &&
            githubToken &&
            repository &&
            /^\d+$/.test(pullRequest) &&
            /^[a-f0-9]{40}$/.test(revision),
        'Missing or invalid PR credentials/identity.',
    );
    const report = Object.fromEntries(
        metadata
            .split(/\r?\n/)
            .filter((line) => line.includes('='))
            .map((line) => {
                const index = line.indexOf('=');
                return [line.slice(0, index), line.slice(index + 1)];
            }),
    );
    const dashboard = new URL(report.dashboardUrl);
    requireValue(
        report.projectKey === project &&
            report.serverUrl === SONAR &&
            report.ceTaskId &&
            dashboard.origin === SONAR &&
            dashboard.searchParams.get('pullRequest') === pullRequest &&
            dashboard.searchParams.get('id') === project,
        'Scanner report does not identify this project and PR.',
    );
    async function get(origin, path, params, credential) {
        const url = new URL(path, origin);
        url.search = new URLSearchParams(params).toString();
        const response = await request(url, {
            headers: { Authorization: `Bearer ${credential}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(30_000),
        });
        requireValue(response.ok, `API request failed (${response.status}) at ${url.pathname}.`);
        return response.json();
    }
    async function verifyHead() {
        const pr = await get(
            'https://api.github.com',
            `/repos/${repository}/pulls/${pullRequest}`,
            {},
            githubToken,
        );
        requireValue(
            pr.state === 'open' && pr.head?.sha === revision,
            'PR head changed or PR closed; rerun analysis for the current commit.',
        );
    }
    await verifyHead();
    const { task } = await get(SONAR, '/api/ce/task', { id: report.ceTaskId }, token);
    requireValue(
        task?.id === report.ceTaskId &&
            task.status === 'SUCCESS' &&
            task.componentKey === project &&
            task.analysisId,
        'This scanner task has not completed successfully for the expected project.',
    );
    const { projectStatus } = await get(
        SONAR,
        '/api/qualitygates/project_status',
        { analysisId: task.analysisId },
        token,
    );
    requireValue(
        ['OK', 'ERROR'].includes(projectStatus?.status),
        'Quality gate result is missing or incomplete.',
    );
    const issues = [];
    let total;
    for (let page = 1; ; page++) {
        const result = await get(
            SONAR,
            '/api/issues/search',
            { componentKeys: project, pullRequest, resolved: 'false', ps: '100', p: String(page) },
            token,
        );
        requireValue(
            Number.isInteger(result.paging?.total) &&
                result.paging.total >= 0 &&
                Array.isArray(result.issues),
            'Malformed Sonar issue response.',
        );
        total ??= result.paging.total;
        requireValue(
            total === result.paging.total && total <= 10000,
            'Issue results changed or exceed the reporting limit; rerun analysis.',
        );
        requireValue(
            result.issues.every(
                (issue) =>
                    typeof issue.key === 'string' &&
                    issue.project === project &&
                    typeof issue.component === 'string' &&
                    typeof issue.rule === 'string' &&
                    typeof issue.message === 'string',
            ),
            'Malformed issue details.',
        );
        issues.push(...result.issues);
        requireValue(issues.length <= total, 'Inconsistent issue count.');
        if (issues.length === total) break;
        requireValue(result.issues.length > 0, 'Incomplete issue pagination.');
    }
    requireValue(
        new Set(issues.map((issue) => issue.key)).size === total,
        'Duplicate issues in paginated results.',
    );
    await verifyHead();
    const rows = issues.map(
        (issue) =>
            `| ${escapeCell(issue.component.replace(`${project}:`, ''))} | ${escapeCell(issue.line ?? '—')} | ${escapeCell(issue.rule)} | ${escapeCell(issue.message)} |`,
    );
    const summary = [
        '## Sonar PR issue policy',
        `PR #${pullRequest}, commit \`${revision}\`, analysis \`${task.analysisId}\`.`,
        `**${total} unresolved issue(s). Zero are allowed.** Quality gate: ${projectStatus.status}.`,
        `[View Sonar analysis](${dashboard.href})`,
        '',
        '| File | Line | Rule | Issue |',
        '| --- | --- | --- | --- |',
        ...rows,
        '',
    ].join('\n');
    return { passed: total === 0 && projectStatus.status === 'OK', summary };
}

async function main() {
    try {
        const result = await checkSonarIssues({
            token: process.env.SONAR_TOKEN,
            githubToken: process.env.GITHUB_TOKEN,
            repository: process.env.GITHUB_REPOSITORY,
            pullRequest: process.env.PR_NUMBER,
            revision: process.env.PR_HEAD_SHA,
            project: 'utkarshutt2706_expense-splitter-api',
            metadata: await readFile('.scannerwork/report-task.txt', 'utf8'),
        });
        await appendFile(process.env.GITHUB_STEP_SUMMARY, result.summary);
        if (!result.passed)
            throw new Error('Sonar PR policy failed. Fix the reported issues and rerun analysis.');
    } catch (error) {
        // Do not log response bodies or credentials from external services.
        const message = error instanceof Error ? error.message : 'Unknown verification error';
        await appendFile(
            process.env.GITHUB_STEP_SUMMARY,
            `\n**Sonar verification failed:** ${escapeCell(message)}\n`,
        );
        console.error('Sonar verification failed; see the job summary.');
        process.exitCode = 1;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
