import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkSonarIssues } from './check-sonar-issues.mjs';

const project = 'utkarshutt2706_expense-splitter-api';
const revision = 'a'.repeat(40);
const config = {
    token: 'test-sonar',
    githubToken: 'test-github',
    repository: 'owner/repo',
    pullRequest: '12',
    revision,
    project,
    metadata: `projectKey=${project}\nserverUrl=https://sonarcloud.io\nceTaskId=task-1\ndashboardUrl=https://sonarcloud.io/dashboard?id=${project}&pullRequest=12\n`,
};
const issue = (key) => ({
    key,
    project,
    component: `${project}:src/file.ts`,
    line: 7,
    rule: 'typescript:S3776',
    message: 'Reduce | complexity <now>\nplease',
});
function api({
    issues = [],
    gate = 'OK',
    status = 'SUCCESS',
    changedHead = false,
    malformed = false,
    failure = false,
} = {}) {
    let headReads = 0;
    return async (url, options) => {
        let data;
        if (url.hostname === 'api.github.com') {
            assert.equal(options.headers.Authorization, 'Bearer test-github');
            headReads++;
            data = {
                state: 'open',
                head: { sha: changedHead && headReads > 1 ? 'b'.repeat(40) : revision },
            };
        } else {
            assert.equal(options.headers.Authorization, 'Bearer test-sonar');
            if (failure) return { ok: false, status: 403 };
            switch (url.pathname) {
                case '/api/ce/task':
                    assert.equal(url.searchParams.get('id'), 'task-1');
                    data = {
                        task: {
                            id: 'task-1',
                            status,
                            componentKey: project,
                            analysisId: 'analysis-1',
                        },
                    };
                    break;
                case '/api/qualitygates/project_status':
                    assert.equal(url.searchParams.get('analysisId'), 'analysis-1');
                    data = { projectStatus: { status: gate } };
                    break;
                case '/api/issues/search': {
                    assert.equal(url.searchParams.get('pullRequest'), '12');
                    assert.equal(url.searchParams.get('resolved'), 'false');
                    const offset = (Number(url.searchParams.get('p')) - 1) * 100;
                    data = malformed
                        ? {}
                        : {
                              paging: { total: issues.length },
                              issues: issues.slice(offset, offset + 100),
                          };
                    break;
                }
                default:
                    throw new Error('Unexpected endpoint');
            }
        }
        return { ok: true, json: async () => data };
    };
}

test('passes only a completed analysis with zero unresolved PR issues', async () => {
    const result = await checkSonarIssues(config, api());
    assert.equal(result.passed, true);
    assert.match(result.summary, /0 unresolved/);
    assert.match(result.summary, /analysis-1/);
});
test('fails even a green quality gate when issues exist and reports all pages', async () => {
    const result = await checkSonarIssues(
        config,
        api({ issues: Array.from({ length: 101 }, (_, n) => issue(String(n))) }),
    );
    assert.equal(result.passed, false);
    assert.match(result.summary, /101 unresolved/);
    assert.equal(result.summary.split('| src/file.ts |').length - 1, 101);
    assert.match(result.summary, /&#124; complexity &lt;now&gt; please/);
});
test('keeps failed quality gates blocking even without issues', async () => {
    assert.equal((await checkSonarIssues(config, api({ gate: 'ERROR' }))).passed, false);
});
for (const status of ['PENDING', 'IN_PROGRESS', 'FAILED', 'CANCELED']) {
    test(`rejects task status ${status}`, async () => {
        await assert.rejects(checkSonarIssues(config, api({ status })), /not completed/);
    });
}
for (const [option, pattern] of [
    ['changedHead', /head changed/],
    ['malformed', /Malformed/],
    ['failure', /403/],
]) {
    test(`fails closed on ${option}`, async () => {
        await assert.rejects(checkSonarIssues(config, api({ [option]: true })), pattern);
    });
}
test('rejects scanner metadata belonging to another PR', async () => {
    await assert.rejects(
        checkSonarIssues(
            { ...config, metadata: config.metadata.replace('pullRequest=12', 'pullRequest=13') },
            api(),
        ),
        /does not identify/,
    );
});
test('requires credentials rather than accepting anonymous partial responses', async () => {
    await assert.rejects(checkSonarIssues({ ...config, token: '' }, api()), /credentials/);
});
