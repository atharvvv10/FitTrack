import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const Dashboard = ({ plan, context, setView }) => {
    // 1. STATE FOR REAL-TIME TRACKING
    const [stats, setStats] = useState({
        calories: 0,
        protein: 0,
        workoutTime: 0,
        streak: 0,
        completedExercises: 0,
        totalWorkouts: 0
    });
    const [loading, setLoading] = useState(true);

    const { workout, diet } = plan || {};

    // 2. FETCH DATA (Source of Truth: DATABASE)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const todayDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

                    // A. FETCH DIET LOGS (Database + LocalStorage Fallback)
                    let consumedCals = 0;
                    let consumedPro = 0;

                    const dietRes = await fetch(`/api/diet/logs?userId=${user.uid}&date=${todayDate}`);
                    let usedDb = false;

                    if (dietRes.ok) {
                        const logs = await dietRes.json();
                        if (logs.length > 0) {
                            usedDb = true;
                            logs.forEach(log => {
                                if (log.completed) {
                                    consumedCals += (parseInt(log.calories) || 0);
                                    consumedPro += (parseInt(log.protein) || 0);
                                }
                            });
                        }
                    }

                    // Fallback to LocalStorage if DB empty (matches Diet.jsx behavior)
                    if (!usedDb) {
                        try {
                            const localDiet = JSON.parse(localStorage.getItem('fittrack_diet_tracking') || '{}');
                            // LocalStorage uses local timezone date usually, ensuring match
                            // We compare strictly if needed, or just trust 'today's' data is in there if date matches
                            // The helper in Diet.jsx uses local ISO split.
                            if (localDiet.date === todayDate) {
                                const parseNum = (val) => (typeof val === 'number' ? val : parseInt(val?.replace(/[^0-9]/g, '') || 0));
                                Object.keys(localDiet.eaten || {}).forEach(key => {
                                    if (localDiet.eaten[key] && diet?.meals?.[key]) {
                                        consumedCals += parseNum(diet.meals[key].cals);
                                        consumedPro += parseNum(diet.meals[key].protein);
                                    }
                                });
                            }
                        } catch (e) {
                            console.warn("Local fallback failed", e);
                        }
                    }

                    // B. FETCH WORKOUT HISTORY (Database)
                    const workoutRes = await fetch(`/api/workouts/${user.uid}`);
                    let streakStr = 0;
                    let todayTime = 0;
                    let totalCount = 0;

                    if (workoutRes.ok) {
                        const history = await workoutRes.json();
                        totalCount = history.length;

                        // Filter for Today
                        const todayLogs = history.filter(h => h.date && h.date.startsWith(todayDate));
                        todayTime = todayLogs.reduce((acc, curr) => acc + (parseInt(curr.duration) || 0), 0);

                        if (totalCount > 0) streakStr = Math.min(totalCount, 5);
                    }

                    setStats({
                        calories: consumedCals,
                        protein: consumedPro,
                        workoutTime: Math.round(todayTime / 60),
                        streak: streakStr,
                        completedExercises: 0,
                        totalWorkouts: totalCount
                    });

                } catch (err) {
                    console.error("Dashboard fetch error", err);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [plan]); // Re-run if plan changes (e.g. after diet generation)


    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Dashboard...</div>;

    if (!workout) return (
        <div className="premium-card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
            <h2>Welcome to FitTrack Premium</h2>
            <p style={{ color: '#888', margin: '16px 0 24px' }}>Your AI Coach is ready. Complete your profile to generate your first plan.</p>
            <button className="btn btn-primary" onClick={() => setView('Profile')}>Setup Profile</button>
        </div>
    );

    // Derived Targets (Avoid /0)
    const targetCals = parseInt(diet?.calories) || 2400;
    const targetPro = parseInt(diet?.protein?.replace('g', '')) || 150;
    const targetTime = plan?.workout?.totalDuration || 60;

    // Percentages
    const calPct = Math.min(100, Math.round((stats.calories / targetCals) * 100));
    const proPct = Math.min(100, Math.round((stats.protein / targetPro) * 100));
    const timePct = Math.min(100, Math.round((stats.workoutTime / targetTime) * 100));

    // Quick Helpers for mini-cards
    const StatCard = ({ label, value, sub, icon, color }) => (
        <div className="premium-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color }}>{icon}</span>
                <span>{value}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#555' }}>{sub}</div>
        </div>
    );

    return (
        <div className="dashboard-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>

            {/* 1. HEADER */}
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Hello, {auth.currentUser?.displayName?.split(' ')[0] || 'Athlete'}</h1>
                    <p style={{ margin: 0 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
                {/* User Avatar could go here */}
            </header>

            {/* 2. TODAY SUMMARY ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <StatCard label="Calories" value={stats.calories} sub={`/ ${targetCals} kcal`} icon="🔥" color="#FF5722" />
                <StatCard label="Protein" value={`${stats.protein}g`} sub={`/ ${targetPro} g`} icon="🥩" color="#4CAF50" />
                <StatCard label="Activity" value={`${stats.workoutTime}m`} sub={`/ ${targetTime} min`} icon="⏱" color="#FFFFFF" />
                <StatCard label="Streak" value={stats.streak} sub="Days Active" icon="🔥" color="#FF9800" />
            </div>

            {/* MAIN CONTENT GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* 3. TODAY WORKOUT (COMPACT) */}
                    <div>
                        <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Today's Workout</h3>
                        <div className="premium-card" style={{
                            padding: '24px',
                            background: 'linear-gradient(135deg, rgba(20,20,25,0.9), rgba(30,30,40,0.9))',
                            borderLeft: '4px solid var(--accent-purple)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px' }}>{workout?.title || "Rest Day"}</h2>
                                    <div style={{ display: 'flex', gap: '12px', color: '#ccc', fontSize: '0.85rem' }}>
                                        <span>⏱ {workout?.totalDuration || 0} min</span>
                                        <span style={{ opacity: 0.5 }}>•</span>
                                        <span>⚡ {context.level || 'General'}</span>
                                        <span style={{ opacity: 0.5 }}>•</span>
                                        <span>🏋️ {workout?.exercises?.length || 0} exercises</span>
                                    </div>
                                </div>
                                <div style={{
                                    background: 'rgba(138, 43, 226, 0.15)',
                                    color: 'var(--accent-purple)',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    fontSize: '0.7rem',
                                    marginTop: '4px'
                                }}>
                                    {context.level?.toUpperCase() || 'MEMBER'}
                                </div>
                            </div>

                            <button
                                onClick={() => setView('Workouts')}
                                className="btn btn-primary"
                                style={{
                                    alignSelf: 'flex-start',
                                    padding: '10px 20px',
                                    fontSize: '0.95rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                <span>Start Session</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>

                    {/* 4. DAILY PROGRESS */}
                    <div>
                        <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Daily Progress</h3>
                        <div className="premium-card" style={{ padding: '24px' }}>

                            {/* Calories Bar */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                                    <span style={{ fontWeight: '600' }}>Calories</span>
                                    <span style={{ color: '#888' }}>{calPct}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${calPct}%`, height: '100%', background: '#FF5722', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                                </div>
                            </div>

                            {/* Protein Bar */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                                    <span style={{ fontWeight: '600' }}>Protein</span>
                                    <span style={{ color: '#888' }}>{proPct}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${proPct}%`, height: '100%', background: '#4CAF50', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                                </div>
                            </div>

                            {/* Workout Bar */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                                    <span style={{ fontWeight: '600' }}>Workout</span>
                                    <span style={{ color: '#888' }}>{timePct}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${timePct}%`, height: '100%', background: 'var(--accent-purple)', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* 5. PROGRESS SNAPSHOT (Formerly Consistency) */}
                    <div>
                        <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Snapshot</h3>
                        <div className="premium-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ color: '#ccc' }}>Total Workouts</span>
                                <span style={{ fontWeight: 'bold' }}>{stats.totalWorkouts || 0}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ color: '#ccc' }}>Consistency</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--accent-purple)' }}>{stats.streak > 3 ? 'High' : 'Building'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#ccc' }}>Active Plan</span>
                                <span style={{ fontWeight: 'bold' }}>{context.goal || 'General'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 6. AI COACH TIP */}
                    <div>
                        <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>AI Coach Tip</h3>
                        <div className="premium-card" style={{ padding: '24px', background: 'rgba(138, 43, 226, 0.05)', border: '1px solid rgba(138, 43, 226, 0.2)' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🤖</span>
                                <span>Recovery Focus</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '16px', lineHeight: '1.5' }}>
                                You've been pushing hard on strength. Consider adding 15 min of mobility work today to improve recovery.
                            </p>
                            <button
                                onClick={() => setView('Workouts', { filter: 'Recovery-friendly' })}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--accent-purple)',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                }}
                            >
                                View Recovery Plan →
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
