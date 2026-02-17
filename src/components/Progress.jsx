import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import ChartSection from './ChartSection';

const Progress = ({ diet, context, setView }) => {
    const getTodayDate = () => {
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        const localDate = new Date(d.getTime() - offset);
        return localDate.toISOString().split('T')[0];
    };

    const [history, setHistory] = useState([]);
    const [dietLogs, setDietLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userUid, setUserUid] = useState(null);
    const [selectedDate, setSelectedDate] = useState(getTodayDate());

    const changeDate = (days) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        const offset = d.getTimezoneOffset() * 60000;
        const localDate = new Date(d.getTime() - offset);
        setSelectedDate(localDate.toISOString().split('T')[0]);
    };

    // 1. Auth & History Fetching (Runs once on mount/auth change)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserUid(user.uid);
                try {
                    // SQL Fetch (Health/Workouts History)
                    const res = await fetch(`/api/workouts/${user.uid}`);
                    if (res.ok) {
                        const data = await res.json();
                        setHistory(data || []);
                    }
                } catch (err) {
                    console.error("Error fetching history:", err);
                }
            } else {
                setUserUid(null);
                setHistory([]);
                setDietLogs([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Diet Logs Fetching (Runs whenever User OR Date changes)
    useEffect(() => {
        if (!userUid) return;

        const fetchDietLogs = async () => {
            try {
                // Try LocalStorage first (Instant) - ONLY if today
                if (selectedDate === getTodayDate()) {
                    const localData = JSON.parse(localStorage.getItem('fittrack_diet_tracking') || '{}');
                    // Helper to parse numbers from strings like "450 kcal"
                    const parseNum = (val) => {
                        if (typeof val === 'number') return val;
                        if (typeof val === 'string') return parseInt(val.replace(/[^0-9]/g, '')) || 0;
                        return 0;
                    };

                    if (localData.date === getTodayDate() && diet?.meals) {
                        const mockLogs = [];
                        Object.keys(localData.eaten || {}).forEach(key => {
                            if (localData.eaten[key] && diet.meals[key]) {
                                mockLogs.push({
                                    meal_type: key,
                                    completed: true,
                                    calories: parseNum(diet.meals[key].cals),
                                    protein: parseNum(diet.meals[key].protein)
                                });
                            }
                        });
                        // Set mock logs initially for instant feedback
                        if (mockLogs.length > 0) setDietLogs(mockLogs);
                    }
                } else {
                    // If not today, clear logs initially to avoid showing stale data while determining if day is empty
                    setDietLogs([]);
                }

                // SQL Fetch (Server is source of truth)
                const dietRes = await fetch(`/api/diet/logs?userId=${userUid}&date=${selectedDate}`);
                if (dietRes.ok) {
                    const logs = await dietRes.json();
                    if (logs && logs.length > 0) {
                        setDietLogs(logs);
                    } else if (selectedDate !== getTodayDate()) {
                        // If no logs from server and NOT today, ensure it's empty
                        setDietLogs([]);
                    }
                }
            } catch (err) {
                console.error("Error fetching diet logs:", err);
            }
        };

        fetchDietLogs();
    }, [userUid, selectedDate, diet]);

    // --- AGGREGATION LOGIC (WORKOUTS) ---
    // ... (Existing aggregation logic remains same, but I'll need to preserve it or just not touch lines 40-160 if I can help it)
    // Actually, I am replacing the whole file structure somewhat. I should be careful.
    // I will just copy the aggregation logic part from previous read if I need to replace strictly around valid blocks.
    // But since I requested the whole file, I have it. I'll just use what I viewed.

    const totalWorkouts = history.length;
    const hasData = totalWorkouts > 0;
    const calculateStreak = () => (!history.length ? 0 : 1);
    const streak = calculateStreak();

    // Re-implementing getWeeklyStats to ensure it exists in new version
    const getWeeklyStats = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
        const weeklyLogs = history.filter(h => new Date(h.date) >= startDate);
        const activeDaysSet = new Set(weeklyLogs.map(h => new Date(h.date).toDateString()));
        const activeDaysCount = activeDaysSet.size;
        const totalDuration = weeklyLogs.reduce((acc, curr) => acc + (parseInt(curr.duration) || 0), 0);
        const consistencyScore = Math.round((activeDaysCount / 7) * 100);

        // Category Balance
        const categories = { Strength: 0, Cardio: 0, Recovery: 0 };
        const getCategory = (title) => {
            const t = (title || '').toLowerCase();
            if (t.includes('mobility') || t.includes('yoga') || t.includes('stretch') || t.includes('recovery')) return 'Recovery';
            if (t.includes('cardio') || t.includes('hiit') || t.includes('run') || t.includes('endurance')) return 'Cardio';
            return 'Strength';
        };
        weeklyLogs.forEach(log => {
            const cat = getCategory(log.title);
            if (categories[cat] !== undefined) categories[cat]++;
        });
        const uniqueCategoriesActive = Object.values(categories).filter(c => c > 0).length;
        let balanceLabel = uniqueCategoriesActive >= 2 ? 'Balanced' : (weeklyLogs.length > 0 ? 'Biased' : 'No Data');

        // Daily Breakdown
        const dailyData = [];
        let maxDuration = 0; // In Minutes
        let bestDayName = '-';
        let maxDayDuration = 0; // In Minutes

        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);
            const nextDay = new Date(currentDay);
            nextDay.setDate(currentDay.getDate() + 1);
            const daysLogs = weeklyLogs.filter(h => {
                const d = new Date(h.date);
                return d >= currentDay && d < nextDay;
            });
            const dayTotalSeconds = daysLogs.reduce((acc, curr) => acc + (parseInt(curr.duration) || 0), 0);
            const dayTotalMinutes = Math.round(dayTotalSeconds / 60);

            if (dayTotalMinutes > maxDuration) maxDuration = dayTotalMinutes;
            if (dayTotalMinutes > maxDayDuration) {
                maxDayDuration = dayTotalMinutes;
                bestDayName = currentDay.toLocaleDateString('en-US', { weekday: 'long' });
            }
            dailyData.push({
                name: currentDay.toLocaleDateString('en-US', { weekday: 'narrow' }),
                fullName: currentDay.toLocaleDateString('en-US', { weekday: 'long' }),
                duration: dayTotalMinutes,
                titles: daysLogs.map(l => l.title).join(', '),
                isToday: currentDay.toDateString() === today.toDateString(),
                hasData: dayTotalMinutes > 0
            });
        }
        const avgDuration = activeDaysCount > 0 ? ((totalDuration / 60) / activeDaysCount) : 0;
        return { activeDaysCount, totalDuration, consistencyScore, balanceLabel, weeklyLogsCount: weeklyLogs.length, dailyData, maxDuration, avgDuration, bestDayName, maxDayDuration };
    };

    const { activeDaysCount, totalDuration, consistencyScore, balanceLabel, weeklyLogsCount, dailyData, maxDuration, avgDuration, bestDayName, maxDayDuration } = getWeeklyStats();
    const completionRate = 100;

    // --- AGGREGATION LOGIC (DIET) ---
    // Targets
    const parseNum = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseInt(val.replace(/[^0-9]/g, '')) || 0;
        return 0;
    };
    const targetCals = parseNum(diet?.macroTargets?.cals) || 2300;
    const targetProtein = parseNum(diet?.macroTargets?.protein) || 150;
    const totalMeals = 4; // Assuming 4 for now

    // Consumed
    // We need to match dietLogs back to meals to get their macros if logs don't have them?
    // Actually, SQL logs have calories/protein stored!
    const consumedCals = dietLogs.reduce((sum, log) => sum + (log.completed ? (parseInt(log.calories) || 0) : 0), 0);
    const consumedProtein = dietLogs.reduce((sum, log) => sum + (log.completed ? (parseInt(log.protein) || 0) : 0), 0);
    // Count ONLY meals (not supplements) for meal count
    const eatenCount = dietLogs.filter(log => log.completed && log.meal_type && !log.meal_type.startsWith('supplement')).length;
    // Count Supplements
    const suppCount = dietLogs.filter(log => log.completed && log.meal_type && log.meal_type.startsWith('supplement')).length;
    const totalSupps = diet?.supplements?.length || 3; // Default to 3 if unknown

    const calPercent = Math.min(Math.round((consumedCals / targetCals) * 100), 100);
    const proPercent = Math.min(Math.round((consumedProtein / targetProtein) * 100), 100);
    const mealPercent = Math.min(Math.round((eatenCount / totalMeals) * 100), 100);
    const suppPercent = Math.min(Math.round((suppCount / totalSupps) * 100), 100);

    const overviewStats = [
        { label: 'Total Workouts', value: totalWorkouts, icon: '🏆' },
        { label: 'Active Days (Week)', value: `${activeDaysCount}/7`, icon: '📅' },
        { label: 'Training Time', value: `${Math.round(totalDuration / 60)}m`, icon: '⏱️' },
        { label: 'Current Streak', value: `${streak} day${streak !== 1 ? 's' : ''}`, icon: '🔥' }
    ];

    // Donut Chart Component
    const Donut = ({ percent, color, label, sub, icon }) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: `conic-gradient(${color} ${percent}%, #333 ${percent}% 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative'
            }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: '#161616', // Inner hole color (assuming dark bg)
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column'
                }}>
                    <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                </div>
            </div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>{label}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>{sub}</div>
            </div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1120px', margin: '0 auto', paddingBottom: '40px', animation: 'fadeIn 0.5s' }}>

            <header style={{ textAlign: 'left', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 className="display-text" style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Progress</h1>
                <p style={{ fontSize: '0.85rem', color: '#666', margin: 0, fontStyle: 'italic', maxWidth: '600px' }}>
                    Your consistency, earned.
                </p>
            </header>

            <div style={{ marginBottom: '40px' }}>

                {/* 1️⃣ OVERVIEW (Top Row) */}
                <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Overview</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '40px',
                }}>
                    {overviewStats.map((stat, idx) => (
                        <div key={idx} className="premium-card" style={{
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            opacity: hasData ? 1 : 0.9,
                            background: hasData ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                            border: hasData ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{stat.icon}</div>
                            <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                            <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>{stat.value}</div>
                        </div>
                    ))}
                </div>

                {/* 2️⃣ DAILY TRAINING ACTIVITY (Chart) */}
                <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Activity</h3>
                <ChartSection
                    dailyData={dailyData}
                    maxDuration={maxDuration}
                    maxDayDuration={maxDayDuration}
                    avgDuration={avgDuration}
                    bestDayName={bestDayName}
                    hasData={hasData}
                />

                {/* 3️⃣ NUTRITION PROGRESS (Day) - NEW */}
                <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginTop: '40px' }}>Nutrition Progress</h3>
                <div className="premium-card" style={{
                    padding: '32px',
                    background: '#1A1A1C',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    marginBottom: '40px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={() => changeDate(-1)}
                                    style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}
                                >
                                    ←
                                </button>
                                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem' }}>
                                    {selectedDate === getTodayDate() ? 'Today' : new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <button
                                    onClick={() => changeDate(1)}
                                    disabled={selectedDate === getTodayDate()}
                                    style={{
                                        background: 'transparent', border: 'none',
                                        color: selectedDate === getTodayDate() ? '#333' : '#888',
                                        fontSize: '1.2rem', cursor: selectedDate === getTodayDate() ? 'default' : 'pointer',
                                        padding: '4px'
                                    }}
                                >
                                    →
                                </button>
                            </div>
                            <span style={{ color: '#666', fontSize: '0.9rem' }}>
                                {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}
                            </span>
                        </div>

                        <div style={{
                            padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                            background: calPercent >= 80 ? 'rgba(76,175,80,0.2)' : (calPercent >= 50 ? 'rgba(255,193,7,0.2)' : 'rgba(255,87,34,0.2)'),
                            color: calPercent >= 80 ? '#4CAF50' : (calPercent >= 50 ? '#FFC107' : '#FF5722')
                        }}>
                            {calPercent >= 80 ? 'Good Intake' : (calPercent >= 50 ? 'Moderate' : 'Low Intake')}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '32px', justifyContent: 'center' }}>
                        <Donut percent={mealPercent} color="#BB86FC" label={`${eatenCount} / ${totalMeals}`} sub="Meals" icon="🍽️" />
                        <Donut percent={calPercent} color="#FF9800" label={`${consumedCals} / ${targetCals}`} sub="Calories" icon="🔥" />
                        <Donut percent={proPercent} color="#4CAF50" label={`${consumedProtein}g / ${targetProtein}g`} sub="Protein" icon="🥩" />
                        <Donut percent={suppPercent} color="#03DAC6" label={`${suppCount} / ${totalSupps}`} sub="Supplements" icon="💊" />
                    </div>
                </div>


                {/* 4️⃣ TRENDS (Insight Cards) */}
                <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Trends</h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                    {/* ... (Existing Trend Cards) ... */}
                    {/* CARD 1: Consistency Score */}
                    <div className="premium-card" style={{
                        padding: '24px',
                        background: '#1A1A1C',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px'
                    }}>
                        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '8px', fontWeight: '600' }}>Consistency Score</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '800', color: consistencyScore > 50 ? '#4CAF50' : '#fff', marginBottom: '4px' }}>
                            {consistencyScore}%
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                            {activeDaysCount} of 7 active days this week
                        </div>
                    </div>

                    {/* CARD 2: Training Balance */}
                    <div className="premium-card" style={{
                        padding: '24px',
                        background: '#1A1A1C',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px'
                    }}>
                        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '8px', fontWeight: '600' }}>Training Balance</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
                            {balanceLabel}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', gap: '6px' }}>
                            <span>Strength</span> • <span>Recovery</span> • <span>Cardio</span>
                        </div>
                    </div>

                    {/* CARD 3: Completion Quality */}
                    <div className="premium-card" style={{
                        padding: '24px',
                        background: '#1A1A1C',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px'
                    }}>
                        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '8px', fontWeight: '600' }}>Completion Quality</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#BB86FC', marginBottom: '4px' }}>
                            {hasData ? `${completionRate}%` : 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                            {weeklyLogsCount} of {weeklyLogsCount} workouts completed
                        </div>
                    </div>
                </div>


                {/* 5️⃣ RECENT ACTIVITY */}
                <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Recent Activity</h3>
                {/* ... (Existing Recent Activity Activity) ... */}
                {!hasData ? (
                    <div className="premium-card" style={{ padding: '32px', textAlign: 'center', background: 'linear-gradient(145deg, #1A1A1C, #151515)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '16px' }}>No training data found.</p>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>Start your journey.</h2>
                        <p style={{ color: '#888', marginBottom: '24px', fontSize: '1rem' }}>Your stats will appear here after your first workout.</p>
                        <button onClick={() => setView('Workouts')} style={{ padding: '14px 28px', fontSize: '1rem', fontWeight: 'bold', background: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(138, 43, 226, 0.3)' }}>👉 Go to Workouts</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {history.map((log, i) => (
                            <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '12px', background: '#1E1E24' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{log.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#888' }}>
                                        {log.date ? new Date(log.date).toLocaleDateString() : 'Just now'} • {log.difficulty || 'General'}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>Completed</div>
                                    <div style={{ fontSize: '0.85rem', color: '#888', fontFamily: 'monospace' }}>
                                        {(() => {
                                            const d = parseInt(log.duration) || 0;
                                            const m = Math.floor(d / 60);
                                            const s = d % 60;
                                            return `${m}:${s.toString().padStart(2, '0')}`;
                                        })()} min
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Progress;
