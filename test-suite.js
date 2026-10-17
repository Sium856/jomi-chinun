// Test checklist verification script for জমি চিনুন
async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  console.log('--- Starting জমি চিনুন Automated Test Suite ---\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, details = '') {
    if (cond) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} - ${details}`);
      failed++;
    }
  }

  // 1. Static HTML check: title, brand, and "জমি চিনুন"
  try {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();
    assert(html.includes('<title>জমি চিনুন</title>'), 'HTML Title contains জমি চিনুন');
  } catch (e) {
    assert(false, 'Static HTML fetch', e.message);
  }

  // 2. Admin Login
  let adminCookie = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@demo.com', password: 'admin123' })
    });
    const data = await res.json();
    adminCookie = res.headers.get('set-cookie') || '';
    assert(data.ok && data.user.role === 'admin', 'Admin login (admin@demo.com / admin123)');
  } catch (e) {
    assert(false, 'Admin login', e.message);
  }

  // 3. User Login
  let userCookie = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '252-15-856@diu.edu.bd', password: 'land123' })
    });
    const data = await res.json();
    userCookie = res.headers.get('set-cookie') || '';
    assert(data.ok && data.user.role === 'user', 'User login (252-15-856@diu.edu.bd / land123)');
  } catch (e) {
    assert(false, 'User login', e.message);
  }

  // 4. Check 101/12 with "Rahim Uddin" -> Pass 100
  let userReportId = null;
  try {
    const res = await fetch(`${BASE_URL}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': userCookie },
      body: JSON.stringify({ k: '101', d: '12', s: 'Rahim Uddin' })
    });
    const data = await res.json();
    userReportId = data.report?.id;
    assert(
      data.ok && data.report.status === 'Pass' && data.report.score === 100,
      'Check 101/12 with "Rahim Uddin" = Pass 100',
      `Got status: ${data.report?.status}, score: ${data.report?.score}`
    );
  } catch (e) {
    assert(false, 'Check 101/12', e.message);
  }

  // 5. Check 103/20 with "Abdul Karim" -> Risk Found 25
  try {
    const res = await fetch(`${BASE_URL}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': userCookie },
      body: JSON.stringify({ k: '103', d: '20', s: 'Abdul Karim' })
    });
    const data = await res.json();
    assert(
      data.ok && data.report.status === 'Risk Found' && data.report.score === 25,
      'Check 103/20 with "Abdul Karim" = Risk Found 25',
      `Got status: ${data.report?.status}, score: ${data.report?.score}`
    );
  } catch (e) {
    assert(false, 'Check 103/20', e.message);
  }

  // 6. Check 999/1 -> Not Verified (score null)
  try {
    const res = await fetch(`${BASE_URL}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': userCookie },
      body: JSON.stringify({ k: '999', d: '1', s: 'Any Seller' })
    });
    const data = await res.json();
    assert(
      data.ok && data.report.status === 'Not Verified' && data.report.score === null,
      'Check 999/1 = Not Verified',
      `Got status: ${data.report?.status}, score: ${data.report?.score}`
    );
  } catch (e) {
    assert(false, 'Check 999/1', e.message);
  }

  // 7. Setback for 102/15 -> Verification Required (ok: false)
  try {
    const res = await fetch(`${BASE_URL}/api/setback?k=102&d=15`, {
      headers: { 'Cookie': userCookie }
    });
    const data = await res.json();
    assert(
      data.ok && data.guidance.ok === false,
      'Setback for 102/15 = Verification Required',
      `Guidance ok: ${data.guidance?.ok}`
    );
  } catch (e) {
    assert(false, 'Setback for 102/15', e.message);
  }

  // 8. Normal user calling /api/admin/* gets 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Cookie': userCookie }
    });
    assert(res.status === 403, 'Normal user calling /api/admin/stats gets 403', `Got status ${res.status}`);
  } catch (e) {
    assert(false, 'User calling /api/admin/stats', e.message);
  }

  // 9. Admin calling /api/admin/* gets 200 OK
  try {
    const res = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Cookie': adminCookie }
    });
    const data = await res.json();
    assert(res.status === 200 && data.ok && data.stats.usersCount >= 1, 'Admin calling /api/admin/stats gets 200');
  } catch (e) {
    assert(false, 'Admin calling /api/admin/stats', e.message);
  }

  // 10. A user cannot open another user's report
  try {
    // Admin creates a private report
    const adminCheckRes = await fetch(`${BASE_URL}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ k: '106', d: '5', s: 'Jahangir Alam' })
    });
    const adminReportData = await adminCheckRes.json();
    const adminReportId = adminReportData.report.id;

    // Normal user attempts to access admin's report
    const accessRes = await fetch(`${BASE_URL}/api/reports/${adminReportId}`, {
      headers: { 'Cookie': userCookie }
    });
    assert(accessRes.status === 403, "Normal user cannot access another user's report (403)", `Got status ${accessRes.status}`);
  } catch (e) {
    assert(false, 'User access control on reports', e.message);
  }

  // 11. Forgot password & reset flow
  try {
    // Request reset code
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '252-15-856@diu.edu.bd' })
    });
    const forgotData = await forgotRes.json();
    const code = forgotData.code;

    // Reset password with code
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '252-15-856@diu.edu.bd',
        code: code,
        password: 'land123newpassword'
      })
    });
    const resetData = await resetRes.json();

    // Verify login with new password
    const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '252-15-856@diu.edu.bd',
        password: 'land123newpassword'
      })
    });
    const newLoginData = await newLoginRes.json();

    // Reset back to original password 'land123' for future runs
    await fetch(`${BASE_URL}/api/auth/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '252-15-856@diu.edu.bd' })
    }).then(r => r.json()).then(d => {
      return fetch(`${BASE_URL}/api/auth/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '252-15-856@diu.edu.bd',
          code: d.code,
          password: 'land123'
        })
      });
    });

    assert(
      forgotData.ok && resetData.ok && newLoginData.ok,
      'Forgot password and reset flow operates correctly'
    );
  } catch (e) {
    assert(false, 'Forgot password flow', e.message);
  }

  console.log(`\n--- Test Suite Summary: ${passed} Passed, ${failed} Failed ---`);
  if (failed === 0) {
    console.log('🎉 ALL 11 TEST REQUIREMENTS PASSED!\n');
  }
}

runTests();
