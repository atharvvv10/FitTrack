import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Workouts from './components/Workouts';
import Diet from './components/Diet';
import Profile from './components/Profile';
import Landing from './components/Landing';
import Progress from './components/Progress';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';

import { generateWorkout } from './logic/workoutGenerator';
import { generateDiet } from './logic/dietGenerator';
import { generateAIDiet } from './services/ai';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { saveUserProfile } from './services/userService';

// Placeholder components

const FormAnalysis = () => <div className="card"><h3>AI Form Analysis</h3><p>Upload a video to analyze your lifting form (Coming Soon).</p></div>;

function App() {
  // App State: 'landing' | 'auth' | 'onboarding' | 'dashboard-app'
  const [appState, setAppState] = useState('landing');
  const [loadingSession, setLoadingSession] = useState(true);

  // Dashboard Sub-View
  const [view, setView] = useState('Dashboard');
  const [viewParams, setViewParams] = useState({});

  const handleSetView = (newView, params = {}) => {
    setView(newView);
    setViewParams(params);
  };

  const [userContext, setUserContext] = useState({
    goal: '',
    diet_type: '',
    allergies: '',
    workout_type: '',
    equipment: [],
    level: '',
    stats: '',
    height: '',
    weight: ''
  });

  const [dailyPlan, setDailyPlan] = useState(() => {
    // Attempt greedy initialization if context is somehow ready (rare)
    return {
      workout: null,
      diet: null,
      generatedAt: null
    };
  });

  const [history, setHistory] = useState({
    workouts: [],
    meals: []
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  // 2. FETCH DATA & RESTORE PLAN
  useEffect(() => {
    // A. Auth Check
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // ... (existing auth logic)
      if (user) {
        if (sessionStorage.getItem('isSigningUp')) return;
        const docRef = doc(db, "users", user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.onboardingCompleted) {
              setAppState('dashboard-app');
              if (userData.preferences) {
                setUserContext({ ...userContext, ...userData.preferences });
              }
            } else {
              setAppState('onboarding');
            }
          } else {
            setAppState('onboarding');
          }
        } catch (e) { console.error("Auth error", e); }
      } else {
        if (sessionStorage.getItem('signupSuccess')) setAppState('auth');
        else setAppState('landing');
      }
      setLoadingSession(false);
    });

    // B. Fetch Exercises
    const fetchExercises = async () => {
      try {
        const res = await fetch('/api/exercises');
        if (res.ok) {
          const data = await res.json();
          setExerciseLibrary(data);
          setLibraryLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load exercises", err);
      }
    };
    fetchExercises();

    // C. RESTORE DAILY PLAN FROM LOCAL STORAGE
    const today = new Date().toLocaleDateString('en-CA');
    const savedPlan = localStorage.getItem('fittrack_daily_plan');
    if (savedPlan) {
      const parsed = JSON.parse(savedPlan);
      if (parsed.date === today) {
        console.log("📂 Restored Today's Plan from LocalStorage");
        setDailyPlan(parsed.plan);
      } else {
        console.log("📅 New Day Detected - Plan will regenerate");
        localStorage.removeItem('fittrack_daily_plan');
      }
    }

    return () => unsubscribe();
  }, []);

  const handleRefresh = async (context, initialPlanFromOnboarding = null) => {
    setIsGenerating(true);
    const safeContext = {
      ...context,
      goal: context.goal || 'General Fitness',
      diet_type: context.diet_type || 'Vegetarian'
    };

    // Generate static workout and diet first
    const newWorkout = generateWorkout(safeContext, history.workouts, null, exerciseLibrary);
    const staticDiet = generateDiet(safeContext, history.meals);

    // Set plan immediately with static diet — NO WAITING
    const initialPlan = {
      workout: newWorkout,
      diet: staticDiet,
      generatedAt: Date.now()
    };
    setDailyPlan(initialPlan);
    // SAVE TO LOCAL STORAGE (Instant)
    localStorage.setItem('fittrack_daily_plan', JSON.stringify({ date: new Date().toLocaleDateString('en-CA'), plan: initialPlan }));

    const newExerciseNames = newWorkout.exercises?.map(e => e.name) || [];
    const newMealNames = Object.values(staticDiet.meals).map(m => m.name);

    setHistory(prev => ({
      workouts: [...prev.workouts, ...newExerciseNames].slice(-50),
      meals: [...prev.meals, ...newMealNames].slice(-50)
    }));

    // BACKGROUND: Upgrade to AI Diet (no blocking, no delay)
    generateAIDiet({
      goal: context.goal,
      diet_type: context.diet_type,
      allergies: context.allergies,
      weight: context.weight,
      height: context.height,
      age: context.age,
      gender: context.gender,
      level: context.level
    }).then(async (aiDiet) => {
      console.log("🥗 AI Diet arrived — upgrading plan");

      // If AI diet has supplements, update user context and persist
      if (aiDiet.supplements) {
        const user = auth.currentUser;
        if (user) {
          const newContext = { ...context, supplements: aiDiet.supplements };
          setUserContext(prev => ({ ...prev, supplements: aiDiet.supplements }));
          setDoc(doc(db, "users", user.uid), { preferences: newContext }, { merge: true }).catch(console.error);
        }
      }

      setDailyPlan(prev => {
        const updated = { ...prev, diet: aiDiet, generatedAt: Date.now() };
        // SAVE UPDATE TO LOCAL STORAGE
        localStorage.setItem('fittrack_daily_plan', JSON.stringify({ date: new Date().toLocaleDateString('en-CA'), plan: updated }));
        return updated;
      });

      // Update history with AI diet meals
      const aiMealNames = Object.values(aiDiet.meals).map(m => m.name);
      setHistory(prev => ({
        ...prev,
        meals: [...prev.meals, ...aiMealNames].slice(-50)
      }));

    }).catch(err => {
      console.warn("AI Diet background fetch failed", err);
    }).finally(() => {
      setIsGenerating(false);
    });
  };

  const regenerateDiet = async () => {
    setIsGenerating(true);
    const safeContext = {
      ...userContext,
      goal: userContext.goal || 'General Fitness',
      diet_type: userContext.diet_type || 'Vegetarian'
    };

    const staticDiet = generateDiet(safeContext, history.meals);

    setDailyPlan(prev => {
      const updated = { ...prev, diet: staticDiet, generatedAt: Date.now() };
      localStorage.setItem('fittrack_daily_plan', JSON.stringify({ date: new Date().toLocaleDateString('en-CA'), plan: updated }));
      return updated;
    });

    const newMealNames = Object.values(staticDiet.meals).map(m => m.name);
    setHistory(prev => ({
      ...prev,
      meals: [...prev.meals, ...newMealNames].slice(-50)
    }));

    generateDietPlan({
      goal: safeContext.goal,
      diet_type: safeContext.diet_type,
      allergies: safeContext.allergies,
      weight: safeContext.weight,
      height: safeContext.height,
      age: safeContext.age,
      gender: safeContext.gender,
      level: safeContext.level
    }).then(async (aiDiet) => {
      console.log("🥗 AI Diet arrived (regenerateDiet) — upgrading plan");
      if (aiDiet.supplements) {
        const user = auth.currentUser;
        if (user) {
          const newContext = { ...safeContext, supplements: aiDiet.supplements };
          setUserContext(prev => ({ ...prev, supplements: aiDiet.supplements }));
          setDoc(doc(db, "users", user.uid), { preferences: newContext }, { merge: true }).catch(console.error);
        }
      }
      setDailyPlan(prev => {
        const updated = { ...prev, diet: aiDiet, generatedAt: Date.now() };
        localStorage.setItem('fittrack_daily_plan', JSON.stringify({ date: new Date().toLocaleDateString('en-CA'), plan: updated }));
        return updated;
      });
      const aiMealNames = Object.values(aiDiet.meals).map(m => m.name);
      setHistory(prev => ({
        ...prev,
        meals: [...prev.meals, ...aiMealNames].slice(-50)
      }));
    }).catch(err => {
      console.warn("AI Diet background fetch failed (regenerateDiet)", err);
    }).finally(() => {
      setIsGenerating(false);
    });
  };

  // Auto-generate plan on load if missing
  useEffect(() => {
    // Only generate if we don't have a diet/workout AND we are in dashboard mode
    if (appState === 'dashboard-app' && !dailyPlan.diet && libraryLoaded) {

      // Double check if we already restored it in the first effect (dailyPlan might be null initially)
      const today = new Date().toLocaleDateString('en-CA');
      const savedPlan = localStorage.getItem('fittrack_daily_plan');
      if (savedPlan && JSON.parse(savedPlan).date === today && !dailyPlan.workout) {
        // Should have been restored, but if not, restore here to be safe
        setDailyPlan(JSON.parse(savedPlan).plan);
        return;
      }

      console.log("⚡ Generating New Daily Plan...");
      const safeContext = {
        ...userContext,
        goal: userContext.goal || 'General Fitness',
        diet_type: userContext.diet_type || 'Vegetarian'
      };
      const staticWorkout = generateWorkout(safeContext, history.workouts, null, exerciseLibrary);
      const staticDiet = generateDiet(safeContext, history.meals);

      const newPlan = {
        workout: staticWorkout,
        diet: staticDiet,
        generatedAt: Date.now()
      };

      setDailyPlan(newPlan);
      // SAVE TO LOCAL STORAGE
      localStorage.setItem('fittrack_daily_plan', JSON.stringify({ date: today, plan: newPlan }));
    }
  }, [appState, userContext, dailyPlan.diet, libraryLoaded]);

  const handleOnboardingComplete = async (result) => {
    // result is now { plan, preferences }
    const { plan, preferences } = result;

    const newContext = { ...userContext, ...preferences };
    setUserContext(newContext);

    // Save to Firestore
    const user = auth.currentUser;
    if (user) {
      await setDoc(doc(db, "users", user.uid), {
        onboardingCompleted: true,
        preferences: newContext
      }, { merge: true });
    }

    handleRefresh(newContext, plan);
    setAppState('dashboard-app');
    setView('Dashboard');
  };

  const handleAuthSuccess = () => {
    // Handled by onAuthStateChanged
  };

  // Render logic based on high-level app state
  if (loadingSession || (appState === 'dashboard-app' && !libraryLoaded)) {
    return (
      <div style={{ background: 'var(--bg-deep)', height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner"></div>
        <div>Loading FitTrack...</div>
        {!libraryLoaded && <div style={{ fontSize: '0.8rem' }}>Syncing Exercise Database...</div>}
      </div>
    );
  }

  if (appState === 'landing') {
    return <Landing onGetStarted={() => setAppState('auth')} onLogin={() => setAppState('auth')} />;
  }

  if (appState === 'auth') {
    return <Auth
      onAuthSuccess={handleAuthSuccess}
    />;
  }

  if (appState === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // MAIN APP SHELL (Dashboard et al)
  const navItems = ['Dashboard', 'Workouts', 'Diet & Nutrition', 'Progress', 'Form Analysis', 'Profile & Preferences'];

  const renderView = () => {
    switch (view) {
      case 'Dashboard': return <Dashboard plan={dailyPlan} context={userContext} onRefresh={() => handleRefresh(userContext)} setView={handleSetView} />;
      case 'Workouts': return <Workouts
        context={userContext}
        initialLibrary={exerciseLibrary}
        plannedWorkout={dailyPlan.workout}
        onCompleteDay={regenerateDiet}
        initialFilter={viewParams.filter}
      />;
      case 'Diet & Nutrition': return <Diet diet={dailyPlan.diet} context={userContext} onDayComplete={regenerateDiet} />;
      case 'Progress': return <Progress diet={dailyPlan?.diet} context={userContext} setView={handleSetView} />;
      case 'Form Analysis': return <FormAnalysis />;
      case 'Profile & Preferences': return <Profile
        context={userContext}
        setContext={setUserContext}
        onSave={async () => {
          const user = auth.currentUser;
          if (user) {
            await saveUserProfile(user.uid, { preferences: userContext });
          }
          handleRefresh(userContext);
        }}
      />;
      default: return <Dashboard plan={dailyPlan} context={userContext} />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="app-shell-grid">
        {/* LEFT SIDEBAR */}
        <aside className="sidebar">
          <div style={{ fontWeight: '900', fontSize: '1.4rem', marginBottom: '40px', paddingLeft: '12px' }}>
            FitTrack<span style={{ color: 'var(--accent-purple)' }}>.</span>
          </div>

          <div style={{ flex: 1 }}>
            {navItems.map(item => (
              <div
                key={item}
                className={`nav-item ${view === item ? 'active' : ''}`}
                onClick={() => handleSetView(item)}
              >
                {view === item && <span style={{ marginRight: '8px' }}>•</span>}
                {item}
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="dashboard-main" style={{ position: 'relative' }}>

          {/* TOP RIGHT ACCOUNT MENU - Only on Profile */}
          {view === 'Profile & Preferences' && (
            <div style={{ position: 'absolute', top: '48px', right: '192px', zIndex: 50 }}>
              <DropdownMenu onSignOut={() => signOut(auth)} setView={setView} />
            </div>
          )}

          {renderView()}
        </main>
      </div>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: '#fff' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ color: 'red' }}>{this.state.error && this.state.error.toString()}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px' }}>Reload App</button>
        </div>
      );
    }
    return this.props.children;
  }
}


// User Dropdown Component
const DropdownMenu = ({ onSignOut, setView }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close on click outside (simple implementation)
  useEffect(() => {
    const close = () => setIsOpen(false);
    if (isOpen) window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      {/* Avatar Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '12px',
          transition: 'background 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-purple), #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: '700', fontSize: '1rem',
          boxShadow: '0 2px 10px rgba(138, 43, 226, 0.3)'
        }}>
          F
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>FitTrack Member</div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Personal Plan</div>
        </div>
      </div>

      {/* Dropdown Content */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '120%',
          right: 0,
          width: '200px',
          background: '#1A1A1C',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '8px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="menu-item" style={{ padding: '10px 12px', fontSize: '0.9rem', color: '#888', cursor: 'pointer', borderRadius: '8px' }}>Billing <span style={{ fontSize: '0.7rem', background: '#333', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>SOON</span></div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }}></div>
          <div
            onClick={onSignOut}
            className="menu-item"
            style={{ padding: '10px 12px', fontSize: '0.9rem', color: '#ff6b6b', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Sign Out
          </div>
        </div>
      )}
    </div>
  );
};


export default App;
