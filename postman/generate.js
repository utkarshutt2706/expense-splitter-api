// One-off generator for expense-splitter-api.postman_collection.json.
// Not part of the app build -- run manually with `node postman/generate.js`
// whenever the API surface changes, then delete/regenerate as needed.
const fs = require('fs');
const path = require('path');

function jsonBody(obj) {
    return {
        mode: 'raw',
        raw: JSON.stringify(obj, null, 4),
        options: { raw: { language: 'json' } },
    };
}

function url(pathStr) {
    const segments = pathStr.replace(/^\//, '').split('/');
    return {
        raw: '{{baseUrl}}/' + segments.join('/'),
        host: ['{{baseUrl}}'],
        path: segments,
    };
}

function req(method, pathStr, { body, description, noAuth, badToken } = {}) {
    const headers = [{ key: 'Content-Type', value: 'application/json' }];
    const request = {
        method,
        header: headers,
        url: url(pathStr),
    };
    if (body !== undefined) request.body = jsonBody(body);
    if (description) request.description = description;
    if (noAuth) request.auth = { type: 'noauth' };
    if (badToken) {
        request.auth = {
            type: 'bearer',
            bearer: [{ key: 'token', value: 'not-a-real-token', type: 'string' }],
        };
    }
    return request;
}

function example(name, request, status, code, body) {
    return {
        name,
        originalRequest: request,
        status,
        code,
        _postman_previewlanguage: 'json',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        cookie: [],
        body: body === undefined ? '' : JSON.stringify(body, null, 4),
    };
}

function unauthorizedExample(pathStr, method, body) {
    const request = req(method, pathStr, { body, badToken: true });
    return example('401 Unauthorized - missing/invalid token', request, 'Unauthorized', 401, {
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
}

function forbiddenExample(pathStr, method, body) {
    const request = req(method, pathStr, { body });
    return example('403 Forbidden - not a member of this group', request, 'Forbidden', 403, {
        error: { code: 'FORBIDDEN', message: 'You are not a member of this group' },
    });
}

function item(name, request, responses, description) {
    const entry = { name, request, response: responses };
    if (description) entry.request.description = description;
    return entry;
}

// ---- Seed data used throughout, matching prisma/seed.ts ----
const USERS = {
    current: {
        id: 'current-user',
        name: 'Utkarsh Srivastava',
        email: 'utkarshutt2706@gmail.com',
        phone: '9935744820',
        avatarUrl: null,
    },
    abhay: {
        id: 'friend-abhay',
        name: 'Abhay',
        email: 'abhay.verma@example.com',
        phone: '9876543210',
        avatarUrl: null,
    },
    divanshu: {
        id: 'friend-divanshu',
        name: 'Divanshu',
        email: 'divanshu.gupta@example.com',
        phone: '9123456780',
        avatarUrl: null,
    },
    abhinav: {
        id: 'friend-abhinav',
        name: 'Abhinav',
        email: 'abhinav.singh@example.com',
        phone: '9988776655',
        avatarUrl: null,
    },
    khem: {
        id: 'friend-khem',
        name: 'Khem',
        email: 'khem.chandra@example.com',
        phone: '9871234560',
        avatarUrl: null,
    },
};

const GROUP_ID = 'group-daaru-party';

// =====================================================================
// Health
// =====================================================================
const healthFolder = {
    name: 'Health',
    description: 'Uptime check. Public -- no auth required.',
    item: [
        item(
            'Check API health',
            req('GET', '/health', { noAuth: true }),
            [
                example(
                    '200 OK',
                    req('GET', '/health', { noAuth: true }),
                    'OK',
                    200,
                    { status: 'ok' },
                ),
            ],
            'Always public. Useful as an uptime pinger target since Render\'s free tier spins the service down after idling.',
        ),
    ],
};

// =====================================================================
// Auth
// =====================================================================
// Captures the accessToken from a successful register/login response into
// the `accessToken` collection variable, so the rest of the collection
// (which authenticates via that variable) works right after running either
// request -- no manual copy/pasting of the token required.
const captureAccessTokenScript = {
    listen: 'test',
    script: {
        type: 'text/javascript',
        exec: [
            'if (pm.response.code === 200 || pm.response.code === 201) {',
            '    const body = pm.response.json();',
            '    if (body.accessToken) {',
            "        pm.collectionVariables.set('accessToken', body.accessToken);",
            '    }',
            '}',
        ],
    },
};

const newAccountBody = {
    name: 'New Friend',
    email: 'new.friend@example.com',
    phone: '9000000001',
    password: 'correct-horse-battery-staple',
};
const authUserResponse = (overrides = {}) => ({
    id: '{{$guid}}',
    name: newAccountBody.name,
    email: newAccountBody.email,
    phone: newAccountBody.phone,
    avatarUrl: null,
    ...overrides,
});

const registerItem = item(
    'Register',
    req('POST', '/auth/register', { body: newAccountBody, noAuth: true }),
    [
        example(
            '201 Created',
            req('POST', '/auth/register', { body: newAccountBody, noAuth: true }),
            'Created',
            201,
            { user: authUserResponse(), accessToken: '{{accessToken}}' },
        ),
        example(
            '400 Validation Error - malformed fields',
            req('POST', '/auth/register', {
                body: { email: 'not-an-email', password: 'short' },
                noAuth: true,
            }),
            'Bad Request',
            400,
            {
                error: {
                    code: 'VALIDATION_ERROR',
                    message:
                        'Email must be an email; Password must be longer than or equal to 8 characters; Name must be a string',
                },
            },
        ),
        example(
            '409 Conflict - email already in use',
            req('POST', '/auth/register', {
                body: { ...newAccountBody, email: USERS.current.email },
                noAuth: true,
            }),
            'Conflict',
            409,
            { error: { code: 'CONFLICT', message: 'A user with this email already exists' } },
        ),
        example(
            '201 Created - registering through a group invitation',
            req('POST', '/auth/register', {
                body: { ...newAccountBody, inviteToken: '{{inviteToken}}' },
                noAuth: true,
            }),
            'Created',
            201,
            { user: authUserResponse(), accessToken: '{{accessToken}}' },
        ),
        example(
            '400 Bad Request - email does not match the invitation',
            req('POST', '/auth/register', {
                body: { ...newAccountBody, inviteToken: '{{inviteToken}}' },
                noAuth: true,
            }),
            'Bad Request',
            400,
            { error: { code: 'VALIDATION_ERROR', message: 'Email does not match the invitation' } },
        ),
        example(
            '409 Conflict - invitation is expired, revoked, or already accepted',
            req('POST', '/auth/register', {
                body: { ...newAccountBody, inviteToken: '{{inviteToken}}' },
                noAuth: true,
            }),
            'Conflict',
            409,
            { error: { code: 'CONFLICT', message: 'This invitation is no longer valid' } },
        ),
    ],
    'Public. Creates a user and a passwordHash for them, then returns the same shape as Login -- a ' +
        'public user plus a ready-to-use accessToken. `inviteToken` is optional -- when present (taken ' +
        'from the `?invite=` query param on the registration link emailed by Invitations > Create), ' +
        'registration atomically also joins the invited group and marks the invitation accepted. ' +
        'Saved as a Test script on this request to auto-populate the `accessToken` collection variable.',
);
registerItem.event = [captureAccessTokenScript];

const loginBody = { email: USERS.current.email, password: 'correct-horse-battery-staple' };
const loginItem = item(
    'Login',
    req('POST', '/auth/login', { body: loginBody, noAuth: true }),
    [
        example(
            '200 OK',
            req('POST', '/auth/login', { body: loginBody, noAuth: true }),
            'OK',
            200,
            { user: USERS.current, accessToken: '{{accessToken}}' },
        ),
        example(
            '401 Unauthorized - wrong password or unknown email',
            req('POST', '/auth/login', {
                body: { email: USERS.current.email, password: 'wrong-password' },
                noAuth: true,
            }),
            'Unauthorized',
            401,
            { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
        ),
    ],
    'Public. Also returns the accessToken needed for every other request in this collection -- run this (or Register) first. Saved as a Test script on this request to auto-populate the `accessToken` collection variable.',
);
loginItem.event = [captureAccessTokenScript];

const authFolder = {
    name: 'Auth',
    description:
        'Registration and login. Both are public and return `{ user, accessToken }` -- a 7-day-lived ' +
        'JWT you send as `Authorization: Bearer <accessToken>` on every other request. Run either ' +
        'request here first: both have a saved Test script that copies the returned accessToken into ' +
        'the `accessToken` collection variable automatically.',
    item: [registerItem, loginItem],
};

// =====================================================================
// Users
// =====================================================================
const usersFolder = {
    name: 'Users',
    description:
        'There is no way to manually create a user record or list every registered user -- every ' +
        'account comes from Auth > Register (directly or via an accepted invitation). Use Lookup to ' +
        'find a specific registered user by exact email/phone, or My friends to list users you share ' +
        'a group with. PATCH/DELETE only work on your own account (self-ownership enforced, 403 ' +
        'otherwise).',
    item: [
        item(
            'Lookup user by email or phone',
            req('GET', '/users/lookup?email=' + encodeURIComponent(USERS.abhay.email)),
            [
                example(
                    '200 OK - found by email',
                    req('GET', '/users/lookup?email=' + encodeURIComponent(USERS.abhay.email)),
                    'OK',
                    200,
                    USERS.abhay,
                ),
                example(
                    '200 OK - found by phone',
                    req('GET', '/users/lookup?phone=' + encodeURIComponent(USERS.abhay.phone)),
                    'OK',
                    200,
                    USERS.abhay,
                ),
                example(
                    '400 Bad Request - both email and phone provided',
                    req(
                        'GET',
                        '/users/lookup?email=' +
                            encodeURIComponent(USERS.abhay.email) +
                            '&phone=' +
                            encodeURIComponent(USERS.abhay.phone),
                    ),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Provide only one of email or phone, not both',
                        },
                    },
                ),
                example(
                    '404 Not Found - no registered user matches',
                    req('GET', '/users/lookup?email=nobody%40example.com'),
                    'Not Found',
                    404,
                    {
                        error: {
                            code: 'NOT_FOUND',
                            message: 'No registered user matches that email or phone',
                        },
                    },
                ),
                unauthorizedExample('/users/lookup?email=' + encodeURIComponent(USERS.abhay.email), 'GET'),
            ],
            'Exact match only -- used by the frontend when a searched email/phone isn\'t already in the ' +
                'caller\'s friend list, to decide between "add directly" (found) and "invite by email" (not found).',
        ),
        item(
            'My friends',
            req('GET', '/users/me/friends'),
            [
                example(
                    '200 OK',
                    req('GET', '/users/me/friends'),
                    'OK',
                    200,
                    [USERS.abhay, USERS.divanshu],
                ),
                unauthorizedExample('/users/me/friends', 'GET'),
            ],
            'Derived, not stored: every user the caller has ever shared a group with (bidirectional, ' +
                'deduplicated, survives being removed from the group later).',
        ),
        item(
            'Get user by id',
            req('GET', '/users/{{userId}}'),
            [
                example(
                    '200 OK',
                    req('GET', '/users/{{userId}}'),
                    'OK',
                    200,
                    USERS.current,
                ),
                example(
                    '404 Not Found',
                    req('GET', '/users/does-not-exist'),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'User does-not-exist not found' } },
                ),
                unauthorizedExample('/users/{{userId}}', 'GET'),
            ],
            '{{userId}} defaults to the seeded current-user.',
        ),
        item(
            'Update user',
            req('PATCH', '/users/{{userId}}', { body: { name: 'Utkarsh S.' } }),
            [
                example(
                    '200 OK',
                    req('PATCH', '/users/{{userId}}', { body: { name: 'Utkarsh S.' } }),
                    'OK',
                    200,
                    { ...USERS.current, name: 'Utkarsh S.' },
                ),
                example(
                    '400 Validation Error',
                    req('PATCH', '/users/{{userId}}', { body: { email: 'not-an-email' } }),
                    'Bad Request',
                    400,
                    { error: { code: 'VALIDATION_ERROR', message: 'Email must be an email' } },
                ),
                example(
                    '404 Not Found',
                    req('PATCH', '/users/does-not-exist', { body: { name: 'X' } }),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'User does-not-exist not found' } },
                ),
                example(
                    '409 Conflict - email already in use',
                    req('PATCH', '/users/{{userId}}', { body: { email: USERS.abhay.email } }),
                    'Conflict',
                    409,
                    { error: { code: 'CONFLICT', message: 'A user with this email already exists' } },
                ),
                unauthorizedExample('/users/{{userId}}', 'PATCH', { name: 'Utkarsh S.' }),
                example(
                    '403 Forbidden - not your own account',
                    req('PATCH', '/users/{{userId}}', { body: { name: 'Utkarsh S.' } }),
                    'Forbidden',
                    403,
                    { error: { code: 'FORBIDDEN', message: 'You can only modify your own account' } },
                ),
            ],
            'Partial update -- send only the fields you want to change. Self only: {{userId}} must match the caller.',
        ),
        item(
            'Delete user',
            req('DELETE', '/users/{{userId}}'),
            [
                example('204 No Content', req('DELETE', '/users/{{userId}}'), 'No Content', 204),
                example(
                    '404 Not Found',
                    req('DELETE', '/users/does-not-exist'),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'User does-not-exist not found' } },
                ),
                example(
                    '409 Conflict - user has expenses/group history',
                    req('DELETE', '/users/{{userId}}'),
                    'Conflict',
                    409,
                    {
                        error: {
                            code: 'CONFLICT',
                            message: 'Cannot delete a user referenced by an existing group or expense',
                        },
                    },
                ),
                unauthorizedExample('/users/{{userId}}', 'DELETE'),
                example(
                    '403 Forbidden - not your own account',
                    req('DELETE', '/users/{{userId}}'),
                    'Forbidden',
                    403,
                    { error: { code: 'FORBIDDEN', message: 'You can only modify your own account' } },
                ),
            ],
            'Blocked with 409 if the user has paid for or split any expense, or sent/received a payment. Self only: {{userId}} must match the caller.',
        ),
    ],
};

// =====================================================================
// Groups
// =====================================================================
const newGroupBody = { name: 'Weekend Trip', memberIds: [USERS.current.id, USERS.abhay.id] };
const groupResponse = (overrides = {}) => ({
    id: GROUP_ID,
    name: 'Daaru Party',
    memberIds: Object.values(USERS).map((u) => u.id),
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
});

const groupsFolder = {
    name: 'Groups',
    description:
        'Group CRUD. Rename and membership changes both go through the same PATCH. The caller is ' +
        'always added to memberIds on create even if they left themselves out, and List only returns ' +
        'groups the caller is a member of. Get/Update/Delete are guarded -- non-members get a 403.',
    item: [
        item(
            'Create group',
            req('POST', '/groups', { body: newGroupBody }),
            [
                example(
                    '201 Created',
                    req('POST', '/groups', { body: newGroupBody }),
                    'Created',
                    201,
                    { id: '{{$guid}}', ...newGroupBody, createdAt: '{{$isoTimestamp}}' },
                ),
                example(
                    '400 Validation Error - empty memberIds',
                    req('POST', '/groups', { body: { name: 'Empty Group', memberIds: [] } }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'MemberIds must contain at least 1 elements',
                        },
                    },
                ),
                example(
                    '400 Bad Request - memberId does not reference a user',
                    req('POST', '/groups', {
                        body: { name: 'Bad Group', memberIds: ['does-not-exist'] },
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'One or more memberIds do not reference an existing user',
                        },
                    },
                ),
                unauthorizedExample('/groups', 'POST', newGroupBody),
            ],
            'memberIds must be non-empty, unique, and each reference an existing user.',
        ),
        item(
            'List groups',
            req('GET', '/groups'),
            [example('200 OK', req('GET', '/groups'), 'OK', 200, [groupResponse()])],
        ),
        item(
            'Get group by id',
            req('GET', '/groups/{{groupId}}'),
            [
                example('200 OK', req('GET', '/groups/{{groupId}}'), 'OK', 200, groupResponse()),
                example(
                    '404 Not Found',
                    req('GET', '/groups/does-not-exist'),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Group does-not-exist not found' } },
                ),
                unauthorizedExample('/groups/{{groupId}}', 'GET'),
                forbiddenExample('/groups/{{groupId}}', 'GET'),
            ],
            '{{groupId}} defaults to the seeded group-daaru-party.',
        ),
        item(
            'Update group (rename and/or replace members)',
            req('PATCH', '/groups/{{groupId}}', { body: { name: 'Daaru Party 2.0' } }),
            [
                example(
                    '200 OK - rename only',
                    req('PATCH', '/groups/{{groupId}}', { body: { name: 'Daaru Party 2.0' } }),
                    'OK',
                    200,
                    groupResponse({ name: 'Daaru Party 2.0' }),
                ),
                example(
                    '200 OK - replace membership (full array, not a delta)',
                    req('PATCH', '/groups/{{groupId}}', {
                        body: { memberIds: [USERS.current.id, USERS.abhay.id] },
                    }),
                    'OK',
                    200,
                    groupResponse({ memberIds: [USERS.current.id, USERS.abhay.id] }),
                ),
                example(
                    '400 Bad Request - memberId does not reference a user',
                    req('PATCH', '/groups/{{groupId}}', { body: { memberIds: ['does-not-exist'] } }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'One or more memberIds do not reference an existing user',
                        },
                    },
                ),
                example(
                    '404 Not Found',
                    req('PATCH', '/groups/does-not-exist', { body: { name: 'X' } }),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Group does-not-exist not found' } },
                ),
                unauthorizedExample('/groups/{{groupId}}', 'PATCH', { name: 'Daaru Party 2.0' }),
                forbiddenExample('/groups/{{groupId}}', 'PATCH', { name: 'Daaru Party 2.0' }),
            ],
            'Partial update. `memberIds`, when sent, fully replaces the current membership -- it is not a delta/patch of individual adds or removes.',
        ),
        item(
            'Delete group',
            req('DELETE', '/groups/{{groupId}}'),
            [
                example('204 No Content', req('DELETE', '/groups/{{groupId}}'), 'No Content', 204),
                example(
                    '404 Not Found',
                    req('DELETE', '/groups/does-not-exist'),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Group does-not-exist not found' } },
                ),
                unauthorizedExample('/groups/{{groupId}}', 'DELETE'),
                forbiddenExample('/groups/{{groupId}}', 'DELETE'),
            ],
            'Cascades: deletes the group\'s memberships, expenses, expense splits, and payments too.',
        ),
    ],
};

// =====================================================================
// Invitations
// =====================================================================
const inviteEmail = 'not.registered.yet@example.com';
const invitationResponse = (overrides = {}) => ({
    id: '{{$guid}}',
    groupId: GROUP_ID,
    email: inviteEmail,
    status: 'pending',
    expiresAt: '{{$isoTimestamp}}',
    ...overrides,
});

const invitationsFolder = {
    name: 'Invitations',
    description:
        'Invite an email that is not yet registered to join a group. The raw token is never returned ' +
        'by the API -- it only goes out in the invite email (`${FRONTEND_URL}/register?invite=<token>`), ' +
        'so treat `{{inviteToken}}` below as something you copy from that link/log, not from a response body.',
    item: [
        item(
            'Create invitation',
            req('POST', '/groups/{{groupId}}/invitations', { body: { email: inviteEmail } }),
            [
                example(
                    '201 Created',
                    req('POST', '/groups/{{groupId}}/invitations', { body: { email: inviteEmail } }),
                    'Created',
                    201,
                    invitationResponse(),
                ),
                example(
                    '200 OK - a pending invitation for this email already exists (idempotent)',
                    req('POST', '/groups/{{groupId}}/invitations', { body: { email: inviteEmail } }),
                    'OK',
                    200,
                    invitationResponse(),
                ),
                example(
                    '400 Validation Error - malformed email',
                    req('POST', '/groups/{{groupId}}/invitations', { body: { email: 'not-an-email' } }),
                    'Bad Request',
                    400,
                    { error: { code: 'VALIDATION_ERROR', message: 'Email must be an email' } },
                ),
                example(
                    '409 Conflict - email already belongs to a registered user',
                    req('POST', '/groups/{{groupId}}/invitations', { body: { email: USERS.abhay.email } }),
                    'Conflict',
                    409,
                    {
                        error: {
                            code: 'CONFLICT',
                            message:
                                'A user with this email is already registered -- add them to the group directly instead of inviting',
                        },
                    },
                ),
                example(
                    '409 Conflict - email already an active member of this group',
                    req('POST', '/groups/{{groupId}}/invitations', { body: { email: USERS.divanshu.email } }),
                    'Conflict',
                    409,
                    { error: { code: 'CONFLICT', message: 'This email is already a member of the group' } },
                ),
                unauthorizedExample('/groups/{{groupId}}/invitations', 'POST', { email: inviteEmail }),
                forbiddenExample('/groups/{{groupId}}/invitations', 'POST', { email: inviteEmail }),
            ],
            'Only for emails that are not yet registered. If the email already belongs to a registered ' +
                'user, look them up via Users > Lookup and add them directly with Groups > Update instead.',
        ),
        item(
            'Validate invitation token',
            req('GET', '/invitations/{{inviteToken}}', { noAuth: true }),
            [
                example(
                    '200 OK',
                    req('GET', '/invitations/{{inviteToken}}', { noAuth: true }),
                    'OK',
                    200,
                    { email: inviteEmail, group: { id: GROUP_ID, name: 'Daaru Party' } },
                ),
                example(
                    '404 Not Found - token does not match any invitation',
                    req('GET', '/invitations/not-a-real-token', { noAuth: true }),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Invitation not found' } },
                ),
                example(
                    '409 Conflict - expired, revoked, or already accepted',
                    req('GET', '/invitations/{{inviteToken}}', { noAuth: true }),
                    'Conflict',
                    409,
                    { error: { code: 'CONFLICT', message: 'This invitation is no longer valid' } },
                ),
            ],
            'Public -- no token required to call this endpoint (the invitation token itself is the ' +
                'credential). The frontend calls this when the registration page loads with `?invite=` in ' +
                'the URL, to show which group/email the invite is for before the person registers.',
        ),
    ],
};

// =====================================================================
// Expenses
// =====================================================================
function equalSplitBody(overrides = {}) {
    return {
        description: 'Chai',
        amount: 100,
        paidByUserId: USERS.divanshu.id,
        splitType: 'equal',
        splits: Object.values(USERS).map((u) => ({ userId: u.id, amount: 20 })),
        ...overrides,
    };
}

const expenseResponse = (overrides = {}) => ({
    id: '{{expenseId}}',
    groupId: GROUP_ID,
    description: 'Daaru',
    amount: 5200,
    paidByUserId: USERS.divanshu.id,
    splitType: 'equal',
    splits: Object.values(USERS).map((u) => ({ userId: u.id, amount: 1040 })),
    createdAt: '2026-07-23T10:00:00.000Z',
    ...overrides,
});

const expensesFolder = {
    name: 'Expenses',
    description:
        'Nested under a group. The server independently recomputes the expected split from amount + splitType and rejects the write (400) if it doesn\'t reconcile with what you submitted -- never trust splits blindly.',
    item: [
        item(
            'Create expense - equal split',
            req('POST', '/groups/{{groupId}}/expenses', { body: equalSplitBody() }),
            [
                example(
                    '201 Created',
                    req('POST', '/groups/{{groupId}}/expenses', { body: equalSplitBody() }),
                    'Created',
                    201,
                    expenseResponse({
                        id: '{{$guid}}',
                        description: 'Chai',
                        amount: 100,
                        splits: Object.values(USERS).map((u) => ({ userId: u.id, amount: 20 })),
                        createdAt: '{{$isoTimestamp}}',
                    }),
                ),
                example(
                    '400 Validation Error - missing required field',
                    req('POST', '/groups/{{groupId}}/expenses', {
                        body: { amount: 100, splitType: 'equal', splits: [] },
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Description must be shorter than or equal to 500 characters; Description must be longer than or equal to 1 characters; Description must be a string',
                        },
                    },
                ),
                example(
                    '400 Bad Request - submitted splits do not reconcile (equal)',
                    req('POST', '/groups/{{groupId}}/expenses', {
                        body: equalSplitBody({
                            splits: [
                                { userId: USERS.current.id, amount: 60 },
                                { userId: USERS.abhay.id, amount: 20 },
                            ],
                        }),
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'submitted splits do not reconcile with the server-computed split',
                        },
                    },
                ),
                example(
                    '400 Bad Request - exact split does not sum to amount',
                    req('POST', '/groups/{{groupId}}/expenses', {
                        body: equalSplitBody({
                            splitType: 'exact',
                            splits: [
                                { userId: USERS.current.id, amount: 70 },
                                { userId: USERS.abhay.id, amount: 20 },
                            ],
                        }),
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'splits do not sum to the expense amount for an exact split',
                        },
                    },
                ),
                example(
                    '400 Bad Request - percentages missing for percentage split',
                    req('POST', '/groups/{{groupId}}/expenses', {
                        body: {
                            description: 'Pizza',
                            amount: 1000,
                            paidByUserId: USERS.current.id,
                            splitType: 'percentage',
                            splits: [{ userId: USERS.current.id, amount: 1000 }],
                        },
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'percentages is required for a percentage split',
                        },
                    },
                ),
                example(
                    '400 Bad Request - percentages do not sum to 100',
                    req('POST', '/groups/{{groupId}}/expenses', {
                        body: {
                            description: 'Pizza',
                            amount: 1000,
                            paidByUserId: USERS.current.id,
                            splitType: 'percentage',
                            splits: [
                                { userId: USERS.current.id, amount: 250 },
                                { userId: USERS.abhay.id, amount: 250 },
                            ],
                            percentages: [
                                { userId: USERS.current.id, percentage: 25 },
                                { userId: USERS.abhay.id, percentage: 25 },
                            ],
                        },
                    }),
                    'Bad Request',
                    400,
                    { error: { code: 'VALIDATION_ERROR', message: 'percentages must sum to 100' } },
                ),
                example(
                    '400 Bad Request - shares missing for shares split',
                    req('POST', '/groups/{{groupId}}/expenses', {
                        body: {
                            description: 'Sutta',
                            amount: 300,
                            paidByUserId: USERS.current.id,
                            splitType: 'shares',
                            splits: [{ userId: USERS.current.id, amount: 300 }],
                        },
                    }),
                    'Bad Request',
                    400,
                    { error: { code: 'VALIDATION_ERROR', message: 'shares is required for a shares split' } },
                ),
                example(
                    '400 Bad Request - paidByUserId/split userId does not reference a user',
                    req('POST', '/groups/{{groupId}}/expenses', {
                        body: equalSplitBody({ paidByUserId: 'does-not-exist' }),
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'paidByUserId or a split userId does not reference an existing user',
                        },
                    },
                ),
                example(
                    '404 Not Found - group does not exist',
                    req('POST', '/groups/does-not-exist/expenses', { body: equalSplitBody() }),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Group does-not-exist not found' } },
                ),
                unauthorizedExample('/groups/{{groupId}}/expenses', 'POST', equalSplitBody()),
                forbiddenExample('/groups/{{groupId}}/expenses', 'POST', equalSplitBody()),
            ],
            'splitType is one of equal | exact | percentage | shares. equal recomputes from the participant userIds in `splits`; exact just validates `splits` sums to `amount`; percentage/shares require the matching `percentages`/`shares` array as additional input the server uses to recompute and validate `splits`. Largest-remainder rounding is used so cent-level splits always sum exactly to `amount`.',
        ),
        item(
            'List expenses by group',
            req('GET', '/groups/{{groupId}}/expenses'),
            [
                example(
                    '200 OK',
                    req('GET', '/groups/{{groupId}}/expenses'),
                    'OK',
                    200,
                    [expenseResponse({ id: 'expense-1' })],
                ),
                example(
                    '404 Not Found - group does not exist',
                    req('GET', '/groups/does-not-exist/expenses'),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Group does-not-exist not found' } },
                ),
                unauthorizedExample('/groups/{{groupId}}/expenses', 'GET'),
                forbiddenExample('/groups/{{groupId}}/expenses', 'GET'),
            ],
        ),
        item(
            'Get expense by id',
            req('GET', '/groups/{{groupId}}/expenses/{{expenseId}}'),
            [
                example(
                    '200 OK',
                    req('GET', '/groups/{{groupId}}/expenses/{{expenseId}}'),
                    'OK',
                    200,
                    expenseResponse({ id: '{{expenseId}}' }),
                ),
                example(
                    '404 Not Found - not found in this group',
                    req('GET', '/groups/{{groupId}}/expenses/does-not-exist'),
                    'Not Found',
                    404,
                    {
                        error: {
                            code: 'NOT_FOUND',
                            message: 'Expense does-not-exist not found in group group-daaru-party',
                        },
                    },
                ),
                unauthorizedExample('/groups/{{groupId}}/expenses/{{expenseId}}', 'GET'),
                forbiddenExample('/groups/{{groupId}}/expenses/{{expenseId}}', 'GET'),
            ],
            'Scoped to the group in the URL -- an expense that exists but belongs to a different group also 404s here, rather than leaking cross-group data.',
        ),
        item(
            'Update expense',
            req('PATCH', '/groups/{{groupId}}/expenses/{{expenseId}}', {
                body: equalSplitBody({ description: 'Chai (updated)' }),
            }),
            [
                example(
                    '200 OK',
                    req('PATCH', '/groups/{{groupId}}/expenses/{{expenseId}}', {
                        body: equalSplitBody({ description: 'Chai (updated)' }),
                    }),
                    'OK',
                    200,
                    expenseResponse({
                        id: '{{expenseId}}',
                        description: 'Chai (updated)',
                        amount: 100,
                        splits: Object.values(USERS).map((u) => ({ userId: u.id, amount: 20 })),
                    }),
                ),
                example(
                    '400 Bad Request - submitted splits do not reconcile',
                    req('PATCH', '/groups/{{groupId}}/expenses/{{expenseId}}', {
                        body: equalSplitBody({
                            splits: [{ userId: USERS.current.id, amount: 99999 }],
                        }),
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'submitted splits do not reconcile with the server-computed split',
                        },
                    },
                ),
                example(
                    '404 Not Found',
                    req('PATCH', '/groups/{{groupId}}/expenses/does-not-exist', {
                        body: equalSplitBody(),
                    }),
                    'Not Found',
                    404,
                    {
                        error: {
                            code: 'NOT_FOUND',
                            message: 'Expense does-not-exist not found in group group-daaru-party',
                        },
                    },
                ),
                unauthorizedExample(
                    '/groups/{{groupId}}/expenses/{{expenseId}}',
                    'PATCH',
                    equalSplitBody(),
                ),
                forbiddenExample(
                    '/groups/{{groupId}}/expenses/{{expenseId}}',
                    'PATCH',
                    equalSplitBody(),
                ),
            ],
            'Full replacement, not a partial patch -- resend every field (description, amount, paidByUserId, splitType, splits, and percentages/shares if applicable), validated exactly like create. Same reconciliation rules apply.',
        ),
        item(
            'Delete expense',
            req('DELETE', '/groups/{{groupId}}/expenses/{{expenseId}}'),
            [
                example(
                    '204 No Content',
                    req('DELETE', '/groups/{{groupId}}/expenses/{{expenseId}}'),
                    'No Content',
                    204,
                ),
                example(
                    '404 Not Found',
                    req('DELETE', '/groups/{{groupId}}/expenses/does-not-exist'),
                    'Not Found',
                    404,
                    {
                        error: {
                            code: 'NOT_FOUND',
                            message: 'Expense does-not-exist not found in group group-daaru-party',
                        },
                    },
                ),
                unauthorizedExample('/groups/{{groupId}}/expenses/{{expenseId}}', 'DELETE'),
                forbiddenExample('/groups/{{groupId}}/expenses/{{expenseId}}', 'DELETE'),
            ],
            'Cascades to the expense\'s own splits.',
        ),
    ],
};

// =====================================================================
// Payments
// =====================================================================
const newPaymentBody = { fromUserId: USERS.abhay.id, toUserId: USERS.divanshu.id, amount: 500 };
const paymentResponse = (overrides = {}) => ({
    id: '{{paymentId}}',
    groupId: GROUP_ID,
    fromUserId: USERS.abhay.id,
    toUserId: USERS.divanshu.id,
    amount: 500,
    createdAt: '2026-08-03T04:00:55.004Z',
    ...overrides,
});

const paymentsFolder = {
    name: 'Payments',
    description:
        'A direct transfer between two group members that settles part of a debt. Immutable once created -- create and list-by-group only, no get-by-id/update/delete.',
    item: [
        item(
            'Create payment',
            req('POST', '/groups/{{groupId}}/payments', { body: newPaymentBody }),
            [
                example(
                    '201 Created',
                    req('POST', '/groups/{{groupId}}/payments', { body: newPaymentBody }),
                    'Created',
                    201,
                    paymentResponse({ id: '{{$guid}}', createdAt: '{{$isoTimestamp}}' }),
                ),
                example(
                    '400 Validation Error - missing required field',
                    req('POST', '/groups/{{groupId}}/payments', {
                        body: { fromUserId: USERS.abhay.id },
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'ToUserId must be longer than or equal to 1 characters; ToUserId must be a string; Amount must be a positive number; Amount must be a number conforming to the specified constraints',
                        },
                    },
                ),
                example(
                    '400 Bad Request - fromUserId equals toUserId',
                    req('POST', '/groups/{{groupId}}/payments', {
                        body: { fromUserId: USERS.abhay.id, toUserId: USERS.abhay.id, amount: 100 },
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'fromUserId and toUserId must be different',
                        },
                    },
                ),
                example(
                    '400 Bad Request - fromUserId/toUserId does not reference a user',
                    req('POST', '/groups/{{groupId}}/payments', {
                        body: { fromUserId: 'does-not-exist', toUserId: USERS.divanshu.id, amount: 100 },
                    }),
                    'Bad Request',
                    400,
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'fromUserId or toUserId does not reference an existing user',
                        },
                    },
                ),
                example(
                    '404 Not Found - group does not exist',
                    req('POST', '/groups/does-not-exist/payments', { body: newPaymentBody }),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Group does-not-exist not found' } },
                ),
                unauthorizedExample('/groups/{{groupId}}/payments', 'POST', newPaymentBody),
                forbiddenExample('/groups/{{groupId}}/payments', 'POST', newPaymentBody),
            ],
        ),
        item(
            'List payments by group',
            req('GET', '/groups/{{groupId}}/payments'),
            [
                example(
                    '200 OK',
                    req('GET', '/groups/{{groupId}}/payments'),
                    'OK',
                    200,
                    [paymentResponse({ id: 'payment-1' })],
                ),
                example(
                    '404 Not Found - group does not exist',
                    req('GET', '/groups/does-not-exist/payments'),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Group does-not-exist not found' } },
                ),
                unauthorizedExample('/groups/{{groupId}}/payments', 'GET'),
                forbiddenExample('/groups/{{groupId}}/payments', 'GET'),
            ],
        ),
    ],
};

// =====================================================================
// Balances
// =====================================================================
const balancesFolder = {
    name: 'Balances',
    description:
        'Read-only, derived from every expense and payment in the group. Positive balance = owed money, negative = owes money.',
    item: [
        item(
            'Get group balances',
            req('GET', '/groups/{{groupId}}/balances'),
            [
                example(
                    '200 OK',
                    req('GET', '/groups/{{groupId}}/balances'),
                    'OK',
                    200,
                    {
                        balances: [
                            { userId: 'current-user', balance: -554.16 },
                            { userId: 'friend-abhay', balance: -1376.63 },
                            { userId: 'friend-divanshu', balance: 6393.16 },
                            { userId: 'friend-abhinav', balance: -2307.85 },
                            { userId: 'friend-khem', balance: -2154.52 },
                        ],
                        settlements: [
                            { fromUserId: 'friend-abhinav', toUserId: 'friend-divanshu', amount: 2307.85 },
                            { fromUserId: 'friend-khem', toUserId: 'friend-divanshu', amount: 2154.52 },
                            { fromUserId: 'friend-abhay', toUserId: 'friend-divanshu', amount: 1376.63 },
                            { fromUserId: 'current-user', toUserId: 'friend-divanshu', amount: 554.16 },
                        ],
                    },
                ),
                example(
                    '404 Not Found',
                    req('GET', '/groups/does-not-exist/balances'),
                    'Not Found',
                    404,
                    { error: { code: 'NOT_FOUND', message: 'Group does-not-exist not found' } },
                ),
                unauthorizedExample('/groups/{{groupId}}/balances', 'GET'),
                forbiddenExample('/groups/{{groupId}}/balances', 'GET'),
            ],
            '`settlements` is the Simplify Debt-minimized transaction list -- the fewest payments needed to bring every member to zero, not a raw pairwise ledger. The 200 example here is real output from the seeded demo data.',
        ),
    ],
};

// =====================================================================
// Collection
// =====================================================================
const collection = {
    info: {
        name: 'Expense Splitter API',
        description:
            'Backend API for the Expense Splitter app. Every request except /health and /auth/* ' +
            'requires a JWT: run Register or Login first (Auth folder) and its Test script will copy ' +
            'the returned accessToken into the `accessToken` collection variable automatically, which ' +
            'the rest of the collection sends as `Authorization: Bearer {{accessToken}}`. Auth is ' +
            'per-user now, not a shared secret -- group-scoped endpoints (Groups get/update/delete, ' +
            'all Expenses/Payments/Balances routes) additionally 403 if the caller isn\'t a member of ' +
            'that group.\n\n' +
            'Every endpoint below has saved example responses for its success case and every error ' +
            'case it can actually produce (400/401/403/404/409), generated from the real service code, ' +
            'not guessed. Error responses always follow `{ "error": { "code": string, "message": ' +
            'string } }`, where `code` is one of NOT_FOUND, VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, ' +
            'CONFLICT, or ERROR/INTERNAL_ERROR as a fallback.\n\n' +
            'Set `baseUrl` to `http://localhost:3000` for local dev or your deployed Render URL. ' +
            '`groupId`/`userId`/`expenseId`/`paymentId` default to IDs from the seed script ' +
            '(prisma/seed.ts) -- swap them for real IDs once you\'ve created your own data.',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
    },
    variable: [
        { key: 'baseUrl', value: 'http://localhost:3000', type: 'string' },
        {
            key: 'accessToken',
            value: '',
            type: 'string',
            description: 'Set automatically by the Test script on Auth > Register or Auth > Login',
        },
        { key: 'groupId', value: GROUP_ID, type: 'string' },
        { key: 'userId', value: USERS.current.id, type: 'string' },
        { key: 'expenseId', value: '', type: 'string', description: 'Set after creating/listing an expense' },
        { key: 'paymentId', value: '', type: 'string', description: 'Set after creating/listing a payment' },
        {
            key: 'inviteToken',
            value: '',
            type: 'string',
            description:
                'Copy from the invite link/log after Invitations > Create -- never returned in a response body',
        },
    ],
    item: [
        healthFolder,
        authFolder,
        usersFolder,
        groupsFolder,
        invitationsFolder,
        expensesFolder,
        paymentsFolder,
        balancesFolder,
    ],
};

const outPath = path.join(__dirname, 'expense-splitter-api.postman_collection.json');
fs.writeFileSync(outPath, JSON.stringify(collection, null, 4) + '\n');
console.log('Wrote', outPath);

// Sanity: re-parse to guarantee valid JSON, and count examples.
const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
let requestCount = 0;
let exampleCount = 0;
for (const folder of parsed.item) {
    for (const it of folder.item) {
        requestCount++;
        exampleCount += (it.response || []).length;
    }
}
console.log(`${parsed.item.length} folders, ${requestCount} requests, ${exampleCount} saved examples`);
