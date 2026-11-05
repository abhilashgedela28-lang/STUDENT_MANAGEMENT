const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function runEndToEndTests() {
  console.log('====================================================');
  console.log('       CodeTrack End-to-End Verification Test        ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Actuator Health Check
    console.log('1. Checking Actuator Health Endpoint (/actuator/health)...');
    const healthRes = await axios.get(`${BASE_URL}/actuator/health`);
    assert(healthRes.status === 200, 'Health endpoint returned 200 OK');
    assert(healthRes.data.status === 'UP', 'Application status is UP');
    assert(healthRes.data.components?.db?.status === 'UP', 'MongoDB connection is UP');

    // 2. User Sign Up
    console.log('\n2. Testing User Sign Up (/api/auth/signup)...');
    const userEmail = `alice_${Date.now()}@test.dev`;
    const signupRes = await axios.post(`${BASE_URL}/api/auth/signup`, {
      name: 'Alice Developer',
      email: userEmail,
      password: 'Password123!',
    });
    assert(signupRes.status === 201, 'User signed up with 201 Created');
    assert(signupRes.data.success === true, 'Signup response success is true');
    assert(signupRes.data.user.email === userEmail, 'User email matches');
    assert(signupRes.data.user.role === 'USER', 'Default role is USER');
    const userToken = signupRes.data.token;
    assert(!!userToken, 'JWT token returned on signup');

    const userClient = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${userToken}` },
    });

    // 3. Admin Authentication & Role Protection
    console.log('\n3. Testing Admin Login & Role Protection (/api/auth/login, /api/admin/*)...');
    const adminLoginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@codetrack.dev',
      password: 'Admin@123456',
    });
    assert(adminLoginRes.status === 200, 'Admin logged in with 200 OK');
    assert(adminLoginRes.data.user.role === 'ADMIN', 'Admin user role is ADMIN');
    const adminToken = adminLoginRes.data.token;

    const adminClient = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Verify non-admin gets 403 on admin routes
    try {
      await userClient.get('/api/admin/users');
      assert(false, 'Non-admin accessed /api/admin/users without 403');
    } catch (err) {
      assert(err.response?.status === 403, 'Non-admin rejected from /api/admin/users with 403 Forbidden');
    }

    // 4. Admin Problem Management (URL parse, auto-detect, duplicate rejection)
    console.log('\n4. Testing Admin Problem Management (URL parse, auto-detect, duplicate rejection)...');
    // Ensure 2261A doesn't exist from earlier run
    const existingList = await adminClient.get('/api/admin/problems?search=2261A');
    for (const p of existingList.data.problems || []) {
      if (p.externalId === '2261A') {
        await adminClient.delete(`/api/admin/problems/${p._id}`);
      }
    }

    const testProblemUrl = 'https://codeforces.com/problemset/problem/2261/A';
    const previewRes = await adminClient.post('/api/admin/problems/preview', {
      url: testProblemUrl,
    });
    assert(previewRes.status === 200, 'Parsed Codeforces URL successfully');
    assert(previewRes.data.platform === 'CODEFORCES', 'Auto-detected CODEFORCES platform');
    assert(previewRes.data.externalId === '2261A', 'Parsed externalId 2261A');

    // Add problem 2261A
    const createProbRes = await adminClient.post('/api/admin/problems', {
      platform: previewRes.data.platform,
      externalId: previewRes.data.externalId,
      title: previewRes.data.title || 'Contest 2261 Problem A',
      url: previewRes.data.url,
      difficulty: previewRes.data.difficulty || 'Medium',
      topics: previewRes.data.topics || ['implementation'],
    });
    assert(createProbRes.status === 201, 'Created new problem 2261A via admin');

    // Attempt duplicate
    try {
      await adminClient.post('/api/admin/problems', {
        platform: 'CODEFORCES',
        externalId: '2261A',
        title: 'Duplicate 2261A',
        url: testProblemUrl,
        difficulty: 'Medium',
      });
      assert(false, 'Duplicate problem was not rejected');
    } catch (err) {
      assert(err.response?.status === 409, 'Duplicate problem correctly rejected with 409 Conflict');
    }

    // 5. Practice Page & Problem Listing
    console.log('\n5. Testing Practice Problem Listing (/api/practice)...');
    const practiceListRes = await userClient.get('/api/practice?limit=50');
    assert(practiceListRes.status === 200, 'Fetched problems with 200 OK');
    assert(practiceListRes.data.total >= 20, `Retrieved ${practiceListRes.data.total} total problems (including 20 seeded)`);
    const problemTarget = practiceListRes.data.problems.find(p => p.externalId === '2261A');
    assert(!!problemTarget, 'Problem 2261A exists in practice list');
    assert(problemTarget.status === 'UNSOLVED', 'Initial problem status is UNSOLVED');

    // 6. User Clicks "Solve" -> records STARTED status
    console.log('\n6. Testing Solve Action (opens URL & records STARTED status)...');
    const solveRes = await userClient.post(`/api/practice/${problemTarget.id}/solve`);
    assert(solveRes.status === 200, 'Solve endpoint returned 200 OK');
    assert(solveRes.data.status === 'STARTED', 'Problem status transitioned to STARTED');
    assert(!!solveRes.data.startedAt, 'StartedAt timestamp recorded');

    // 7. Profile Username Linking & Code Generation
    console.log('\n7. Testing Profile Linking & Verification Code Generation (/api/profile/link)...');
    // Clean up any previous test claim for tourist via admin
    await adminClient.delete('/api/admin/links/CODEFORCES/tourist');

    // Test non-existent handle rejection
    try {
      await userClient.post('/api/profile/link', {
        platform: 'CODEFORCES',
        username: 'this_user_definitely_does_not_exist_xyz987',
      });
      assert(false, 'Non-existent Codeforces handle was not rejected');
    } catch (err) {
      assert(err.response?.status === 404, 'Non-existent handle rejected with 404 Not Found');
    }

    // Link real handle 'tourist'
    // First ensure no other test user holds verified lock
    const linkRes = await userClient.post('/api/profile/link', {
      platform: 'CODEFORCES',
      username: 'tourist',
    });
    assert(linkRes.status === 200, 'Link initiated for Codeforces handle tourist');
    assert(linkRes.data.verificationCode.startsWith('CT-'), `Verification code generated: ${linkRes.data.verificationCode}`);
    assert(!!linkRes.data.codeExpiresAt, 'Verification code has 30-min expiry');

    // Test that unverified link cannot sync
    try {
      await userClient.post('/api/practice/sync', { platform: 'CODEFORCES' });
      assert(false, 'Unverified link allowed sync');
    } catch (err) {
      assert(err.response?.status === 400, 'Sync rejected because account is not verified yet');
    }

    // Call real verify endpoint (/api/profile/verify)
    console.log('  Testing Profile Ownership Verification (/api/profile/verify)...');
    const verifyRes = await userClient.post('/api/profile/verify', { platform: 'CODEFORCES' });
    assert(verifyRes.status === 200, 'Profile verified successfully via /api/profile/verify');
    assert(verifyRes.data.verified === true, 'Verification status returned true');

    // 8. User Clicks "Sync" -> verifies accepted submissions and marks SOLVED
    console.log('\n8. Testing Problem Sync (/api/practice/sync)...');
    const syncRes = await userClient.post('/api/practice/sync', { platform: 'CODEFORCES' });
    assert(syncRes.status === 200, 'Sync completed with 200 OK');
    assert(syncRes.data.success === true, 'Sync success is true');
    assert(syncRes.data.problemsChecked > 0, `Checked ${syncRes.data.problemsChecked} problems`);
    console.log(`  Newly solved problems in this sync: ${syncRes.data.newlySolved}`);

    // Verify problem 2261A is now SOLVED
    const refreshedPractice = await userClient.get('/api/practice?limit=50');
    const refreshedTarget = refreshedPractice.data.problems.find(p => p.externalId === '2261A');
    assert(refreshedTarget.status === 'SOLVED', 'Problem 2261A is now verified and marked SOLVED');
    assert(!!refreshedTarget.solvedAt, 'SolvedAt timestamp recorded');

    // 9. Cooldown Protection (45 Seconds)
    console.log('\n9. Testing Rate Limiting & Cooldown Protection (45-second rule)...');
    try {
      await userClient.post('/api/practice/sync', { platform: 'CODEFORCES' });
      assert(false, 'Immediate re-sync was not rate limited');
    } catch (err) {
      assert(err.response?.status === 429, 'Immediate re-sync rejected with HTTP 429 Too Many Requests');
      assert(err.response?.data?.remainingSeconds > 0, `Remaining cooldown returned: ${err.response?.data?.remainingSeconds}s`);
    }

    // 10. Dashboard Analytics & Charts
    console.log('\n10. Testing Dashboard Analytics & Chart Generation (/api/dashboard)...');
    const dashRes = await userClient.get('/api/dashboard');
    assert(dashRes.status === 200, 'Dashboard returned 200 OK');
    assert(dashRes.data.hasLinkedPlatforms === true, 'hasLinkedPlatforms is true');
    assert(dashRes.data.totals.totalSolved > 0, `Total solved across platforms: ${dashRes.data.totals.totalSolved}`);
    assert(dashRes.data.totals.internalSolvedCount >= 1, `Internal practice solved count: ${dashRes.data.totals.internalSolvedCount}`);
    assert(dashRes.data.charts.difficultyBreakdown !== undefined, 'Difficulty breakdown chart data present');
    assert(dashRes.data.charts.ratingTrends !== undefined, 'Contest rating trends data present');
    assert(dashRes.data.charts.solvedOverTime !== undefined, 'Solved over time chart data present');

    // 11. Admin Users & Snapshot Trigger
    console.log('\n11. Testing Admin User Directory & Snapshot Trigger...');
    const userDirRes = await adminClient.get('/api/admin/users');
    assert(userDirRes.status === 200, 'Admin user directory returned 200 OK');
    assert(userDirRes.data.users.length >= 2, `Directory lists ${userDirRes.data.users.length} users`);

    const triggerRes = await adminClient.post('/api/admin/snapshots/trigger');
    assert(triggerRes.status === 200, 'Snapshot trigger returned 200 OK');
    assert(triggerRes.data.result.total >= 1, `Processed snapshots for ${triggerRes.data.result.total} verified links`);

    console.log('\n====================================================');
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nUNEXPECTED TEST ERROR:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Data:', err.response.data);
    }
    process.exit(1);
  }
}

runEndToEndTests();
