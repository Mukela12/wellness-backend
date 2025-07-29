# Frontend Debugging Steps for Blank Screen Issue

## 1. Add Login Response Debugging

In your **login success handler** (likely in `src/services/api.js` or `src/store/authStore.js`), add:

```javascript
// After successful login API call
const handleLoginSuccess = (response) => {
  console.log('🔍 LOGIN DEBUG - Full Response:', response.data);
  
  const { user, accountStatus, nextActions, permissions } = response.data.data;
  
  console.log('🔍 User Info:', {
    role: user.role,
    onboardingCompleted: user.onboarding?.completed,
    emailVerified: user.isEmailVerified
  });
  
  console.log('🔍 Account Status:', {
    needsOnboarding: accountStatus.needsOnboarding,
    needsEmailVerification: accountStatus.needsEmailVerification
  });
  
  console.log('🔍 Next Actions:', nextActions);
  console.log('🔍 Permissions:', {
    requiresOnboarding: permissions.requiresOnboarding,
    canAccessEmployeeDashboard: permissions.canAccessEmployeeDashboard
  });
  
  // Your existing login logic here
};
```

## 2. Add Routing Debug

In your **main App component** or **route guard**, add:

```javascript
// In your routing logic
const ProtectedRoute = ({ children }) => {
  console.log('🔍 ROUTE DEBUG - Current path:', window.location.pathname);
  console.log('🔍 ROUTE DEBUG - User state:', user);
  console.log('🔍 ROUTE DEBUG - Account status:', accountStatus);
  
  if (accountStatus?.needsOnboarding) {
    console.log('🔍 ROUTE DEBUG - Redirecting to onboarding');
    return <Navigate to="/onboarding" replace />;
  }
  
  console.log('🔍 ROUTE DEBUG - Showing protected content');
  return children;
};
```

## 3. Add Onboarding Component Debug

In your **Onboarding component**, add:

```javascript
const OnboardingPage = () => {
  const [questionnaire, setQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchQuestionnaire = async () => {
      try {
        console.log('🔍 ONBOARDING DEBUG - Fetching questionnaire...');
        
        const response = await api.get('/onboarding/questionnaire');
        
        console.log('🔍 ONBOARDING DEBUG - API Response:', response.data);
        console.log('🔍 ONBOARDING DEBUG - Success:', response.data.success);
        
        if (response.data.success) {
          const questionnaireData = response.data.data.questionnaire;
          console.log('🔍 ONBOARDING DEBUG - Questionnaire:', questionnaireData);
          console.log('🔍 ONBOARDING DEBUG - Sections count:', questionnaireData.sections?.length);
          
          if (questionnaireData.sections?.length > 0) {
            console.log('🔍 ONBOARDING DEBUG - First section:', questionnaireData.sections[0]);
            setQuestionnaire(questionnaireData);
          } else {
            console.error('❌ ONBOARDING ERROR - No sections found!');
          }
        }
      } catch (error) {
        console.error('❌ ONBOARDING ERROR - API call failed:', error);
        console.error('❌ ONBOARDING ERROR - Error details:', error.response?.data);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionnaire();
  }, []);
  
  if (loading) {
    console.log('🔍 ONBOARDING DEBUG - Still loading...');
    return <div>Loading onboarding...</div>;
  }
  
  if (!questionnaire) {
    console.log('🔍 ONBOARDING DEBUG - No questionnaire data');
    return <div>Error loading questionnaire</div>;
  }
  
  console.log('🔍 ONBOARDING DEBUG - Rendering questionnaire with', questionnaire.sections.length, 'sections');
  
  // Your existing onboarding JSX here
};
```

## 4. Add Dashboard Component Debug

In your **Dashboard component**, add:

```javascript
const Dashboard = () => {
  console.log('🔍 DASHBOARD DEBUG - Component rendered');
  console.log('🔍 DASHBOARD DEBUG - User:', user);
  console.log('🔍 DASHBOARD DEBUG - Permissions:', permissions);
  
  if (permissions?.requiresOnboarding && !user?.onboarding?.completed) {
    console.log('🔍 DASHBOARD DEBUG - User needs onboarding, redirecting...');
    return <Navigate to="/onboarding" replace />;
  }
  
  console.log('🔍 DASHBOARD DEBUG - Showing dashboard content');
  
  // Your existing dashboard JSX here
};
```

## 5. Browser Console Manual Tests

Open your browser console and run these commands to test the API directly:

```javascript
// Test 1: Check if token exists
console.log('Token:', localStorage.getItem('accessToken')); // or however you store it

// Test 2: Test profile endpoint
fetch('https://wellness-backend-production-48b1.up.railway.app/api/auth/profile', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('accessToken')
  }
})
.then(r => r.json())
.then(data => console.log('Profile API:', data))
.catch(err => console.error('Profile Error:', err));

// Test 3: Test onboarding endpoint
fetch('https://wellness-backend-production-48b1.up.railway.app/api/onboarding/questionnaire', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('accessToken')
  }
})
.then(r => r.json())
.then(data => {
  console.log('Onboarding API:', data);
  console.log('Sections:', data.data?.questionnaire?.sections?.length);
})
.catch(err => console.error('Onboarding Error:', err));
```

## 6. Check for Common Issues

Look for these in your browser console:
- ❌ `Cannot read property 'sections' of undefined`
- ❌ `Failed to fetch`
- ❌ `Network Error`
- ❌ `401 Unauthorized`
- ❌ React component errors

## Expected Working Flow:

1. **Login**: jessekatungu@gmail.com / Milan18$
2. **Backend Response**: `needsOnboarding: true`
3. **Frontend Action**: Redirect to `/onboarding`
4. **Onboarding Page**: Fetch questionnaire → Should get 3 sections
5. **Form Display**: Show demographics, wellness baseline, preferences sections
6. **Submit**: Complete onboarding → Redirect to dashboard

## Quick Test:

Add this temporary button to test the API directly:

```javascript
const TestButton = () => {
  const testAPI = async () => {
    const token = localStorage.getItem('accessToken');
    console.log('Testing with token:', token);
    
    try {
      const response = await fetch('https://wellness-backend-production-48b1.up.railway.app/api/onboarding/questionnaire', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      console.log('API Test Result:', data);
      alert(`Sections found: ${data.data?.questionnaire?.sections?.length || 0}`);
    } catch (error) {
      console.error('API Test Failed:', error);
      alert('API Test Failed - check console');
    }
  };
  
  return <button onClick={testAPI}>Test Onboarding API</button>;
};
```

Add these debugging steps to your frontend and let me know what the console shows!