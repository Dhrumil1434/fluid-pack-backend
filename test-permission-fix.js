const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data from your database
const testData = {
  admin: {
    email: 'dhrumiladmin@1234.com',
    password: 'admin123'
  },
  engineer: {
    email: 'engineer1@company.com',
    password: 'engineer123'
  }
};

let adminToken, engineerToken;

// Helper function to make authenticated requests
const makeAuthRequest = async (method, endpoint, data = null, token = null) => {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    ...(data && { data })
  };
  
  try {
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status 
    };
  }
};

// Helper function to log test results
const logTest = (testName, result) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TEST: ${testName}`);
  console.log(`${'='.repeat(60)}`);
  
  if (result.success) {
    console.log(`✅ SUCCESS (${result.status})`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log(`❌ FAILED (${result.status})`);
    console.log('Error:', JSON.stringify(result.error, null, 2));
  }
};

// Test 1: Login users
const loginUsers = async () => {
  console.log('\n🔐 LOGGING IN USERS...');
  
  // Login admin
  const adminLogin = await makeAuthRequest('POST', '/user/login', {
    email: testData.admin.email,
    password: testData.admin.password
  });
  
  if (adminLogin.success) {
    adminToken = adminLogin.data.data.token;
    console.log('✅ Admin logged in successfully');
  } else {
    console.log('❌ Admin login failed:', adminLogin.error);
    return false;
  }
  
  // Login engineer
  const engineerLogin = await makeAuthRequest('POST', '/user/login', {
    email: testData.engineer.email,
    password: testData.engineer.password
  });
  
  if (engineerLogin.success) {
    engineerToken = engineerLogin.data.data.token;
    console.log('✅ Engineer logged in successfully');
  } else {
    console.log('❌ Engineer login failed:', engineerLogin.error);
    return false;
  }
  
  return true;
};

// Test 2: Clear permission cache
const clearPermissionCache = async () => {
  console.log('\n🗑️ CLEARING PERMISSION CACHE...');
  
  // This will force the system to reload permission configs from database
  const result = await makeAuthRequest('POST', '/permission-config/clear-cache', {}, adminToken);
  
  if (result.success) {
    console.log('✅ Permission cache cleared');
  } else {
    console.log('⚠️ Cache clear failed (this is okay if endpoint doesn\'t exist)');
  }
};

// Test 3: Check engineer permissions
const checkEngineerPermissions = async () => {
  console.log('\n🔍 CHECKING ENGINEER PERMISSIONS...');
  
  const result = await makeAuthRequest('GET', '/permission/my-permissions', null, engineerToken);
  logTest('Engineer Permissions', result);
  
  if (result.success) {
    const permissions = result.data.data.permissions;
    
    // Check CREATE_MACHINE permission
    if (permissions.CREATE_MACHINE) {
      const createPermission = permissions.CREATE_MACHINE;
      console.log('\n📋 CREATE_MACHINE Permission Analysis:');
      console.log(`- Allowed: ${createPermission.allowed}`);
      console.log(`- Requires Approval: ${createPermission.requiresApproval}`);
      console.log(`- Reason: ${createPermission.reason}`);
      console.log(`- Matched By: ${createPermission.matchedBy}`);
      
      if (createPermission.matchedRule) {
        console.log(`- Matched Rule: ${createPermission.matchedRule.name}`);
        console.log(`- Rule Permission: ${createPermission.matchedRule.permission}`);
      }
      
      // Expected behavior for engineer
      if (createPermission.requiresApproval && !createPermission.allowed) {
        console.log('✅ CORRECT: Engineer requires approval for CREATE_MACHINE');
      } else if (createPermission.allowed && !createPermission.requiresApproval) {
        console.log('❌ INCORRECT: Engineer should require approval, not be allowed directly');
      } else {
        console.log('⚠️ UNEXPECTED: Permission result is neither allowed nor requires approval');
      }
    }
  }
};

// Test 4: Check admin permissions
const checkAdminPermissions = async () => {
  console.log('\n🔍 CHECKING ADMIN PERMISSIONS...');
  
  const result = await makeAuthRequest('GET', '/permission/my-permissions', null, adminToken);
  logTest('Admin Permissions', result);
  
  if (result.success) {
    const permissions = result.data.data.permissions;
    
    // Check if admin has full access
    const allActions = Object.keys(permissions);
    const allAllowed = allActions.every(action => permissions[action].allowed);
    
    if (allAllowed) {
      console.log('✅ CORRECT: Admin has full access to all actions');
    } else {
      console.log('❌ INCORRECT: Admin should have full access to all actions');
    }
  }
};

// Test 5: Engineer tries to create machine
const engineerCreatesMachine = async () => {
  console.log('\n🏭 ENGINEER CREATES MACHINE...');
  
  const machineData = {
    name: 'Test Machine by Engineer',
    category_id: '685f92f4abf7c0dbfbb3cb4f', // Production machines category
    images: ['test-image.jpg'],
    metadata: {
      location: 'Building A',
      capacity: '1000 units/hour'
    }
  };
  
  const result = await makeAuthRequest('POST', '/machines', machineData, engineerToken);
  logTest('Engineer Creates Machine', result);
  
  if (result.success) {
    console.log('✅ Machine created successfully');
    console.log(`Machine ID: ${result.data.data._id}`);
    console.log(`Approval Status: ${result.data.data.is_approved ? 'Approved' : 'Pending Approval'}`);
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 STARTING PERMISSION FIX VERIFICATION...');
  console.log('='.repeat(80));
  
  try {
    // Step 1: Login users
    const loginSuccess = await loginUsers();
    if (!loginSuccess) {
      console.log('❌ Login failed, aborting tests');
      return;
    }
    
    // Step 2: Clear cache
    await clearPermissionCache();
    
    // Step 3: Check permissions
    await checkEngineerPermissions();
    await checkAdminPermissions();
    
    // Step 4: Test machine creation
    await engineerCreatesMachine();
    
    console.log('\n🎉 ALL TESTS COMPLETED!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
};

// Run the tests
runTests(); 