
import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase'; // Import Firebase Auth
import { onAuthStateChanged } from 'firebase/auth';

// Helper: Get today's date string (LOCAL TIME)
const getTodayDate = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split('T')[0];
};

const Diet = ({ diet, context, onDayComplete }) => {
    // ===== MEAL TRACKING STATE =====
    // Hybrid Persistence: Load from localStorage immediately for speed
    const [eatenMeals, setEatenMeals] = useState(() => {
        try {
            const saved = localStorage.getItem('fittrack_diet_tracking');
            if (saved) {
                const data = JSON.parse(saved);
                // Only restore if date matches today (clears old data)
                if (data.date === getTodayDate()) {
                    return data.eaten || {};
                }
            }
        } catch (e) { }
        return {};
    });
    const [streak, setStreak] = useState(0);
    const [animatingMeal, setAnimatingMeal] = useState(null);
    const [takenSupps, setTakenSupps] = useState({});
    const [transitioning, setTransitioning] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(true);

    // Load logs from DB on mount (Source of Truth)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoadingLogs(false);
                return;
            }

            const today = getTodayDate();
            try {
                // Fetch from SQL
                const res = await fetch(`/api/diet/logs?userId=${user.uid}&date=${today}`);
                if (res.ok) {
                    const logs = await res.json();

                    // Reconstruct state from logs
                    const newEaten = {};
                    let hasDbData = false;
                    logs.forEach(log => {
                        if (log.completed) {
                            if (log.meal_type.startsWith('supplement_')) {
                                const idx = log.meal_type.split('_')[1];
                                setTakenSupps(prev => ({ ...prev, [idx]: true }));
                            } else if (log.meal_type !== 'supplement') {
                                newEaten[log.meal_type] = true;
                                hasDbData = true;
                            }
                        }
                    });

                    // Only update if DB has data or if we want to enforce DB truth
                    // Ideally DB is truth.
                    if (hasDbData || logs.length > 0) {
                        setEatenMeals(newEaten);
                    }
                }
            } catch (err) {
                console.error("Failed to load diet logs", err);
            } finally {
                setLoadingLogs(false);
            }
        });

        // Still read streak from local storage for now (simplest transition)
        const savedData = JSON.parse(localStorage.getItem('fittrack_diet_tracking') || '{}');
        setStreak(savedData.streak || 0);

        return () => unsubscribe();
    }, []);

    // ===== TOGGLE MEAL STATUS (DB SYNC) =====
    const toggleMeal = async (mealKey, mealData) => {
        const user = auth.currentUser;
        if (!user) return;

        const isCurrentlyEaten = eatenMeals[mealKey];
        const newState = !isCurrentlyEaten; // Toggle

        // 1. Optimistic UI Update
        setAnimatingMeal(mealKey);
        setTimeout(() => setAnimatingMeal(null), 600);
        setEatenMeals(prev => ({ ...prev, [mealKey]: newState }));

        // 2. Sync to DB
        try {
            await fetch('/api/diet/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    date: getTodayDate(),
                    mealType: mealKey,
                    foodName: mealData?.name || 'Unknown',
                    calories: parseInt(mealData?.cals) || 0,
                    protein: parseInt(mealData?.protein) || 0,
                    completed: newState
                })
            });
        } catch (err) {
            console.error("Failed to save meal status", err);
            // Revert on error? For now, just log.
        }
    };

    // ===== TOGGLE SUPPLEMENT STATUS (DB SYNC) =====
    const toggleSupplement = async (suppIndex, suppData) => {
        const user = auth.currentUser;
        if (!user) return;

        const isTaken = takenSupps[suppIndex];
        const newState = !isTaken;

        // 1. Optimistic UI
        setTakenSupps(prev => ({ ...prev, [suppIndex]: newState }));

        // 2. Sync to DB
        try {
            await fetch('/api/diet/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    date: getTodayDate(),
                    mealType: `supplement_${suppIndex}`,
                    foodName: suppData?.name || 'Supplement',
                    calories: 0,
                    protein: 0,
                    completed: newState
                })
            });
        } catch (err) {
            console.error("Failed to save supplement status", err);
        }
    };

    // Save streak/supps to localStorage as backup/streak tracking
    useEffect(() => {
        const today = getTodayDate();
        const trackingData = {
            date: today,
            eaten: eatenMeals, // Mirror state
            supps: takenSupps,
            streak: streak
        };
        localStorage.setItem('fittrack_diet_tracking', JSON.stringify(trackingData));
    }, [eatenMeals, takenSupps, streak]);

    // ===== PROCEED TO NEXT DAY =====
    const proceedToNextDay = () => {
        setTransitioning(true);
        // Reset all tracking
        setEatenMeals({});
        setTakenSupps({});
        // Save updated streak to localStorage with clean state
        const today = getTodayDate();
        localStorage.setItem('fittrack_diet_tracking', JSON.stringify({
            date: today,
            eaten: {},
            supps: {},
            streak: streak
        }));
        // Short delay for visual transition, then trigger new diet generation
        setTimeout(() => {
            if (onDayComplete) onDayComplete();
            setTransitioning(false);
        }, 1500);
    };

    // ===== COMPUTED PROGRESS =====
    // Dynamic meal slots — supports 3, 4, 5, or 6 meals per phase
    const mealSlots = diet?.meals ? Object.keys(diet.meals) : ['breakfast', 'lunch', 'snack', 'dinner'];
    const totalMeals = mealSlots.length;
    const eatenCount = mealSlots.filter(k => eatenMeals[k]).length;
    const progressPercent = (eatenCount / totalMeals) * 100;

    // Track whether streak was already incremented this session
    const [streakBumped, setStreakBumped] = useState(false);

    // Helper: parse numbers from strings like "450 kcal", "35g", "2200", etc.
    const parseNum = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseInt(val.replace(/[^0-9]/g, '')) || 0;
        return 0;
    };

    // Calculate consumed cals/protein
    const consumedCals = mealSlots.reduce((sum, key) => {
        if (eatenMeals[key] && diet?.meals?.[key]) {
            return sum + parseNum(diet.meals[key].cals);
        }
        return sum;
    }, 0);

    const consumedProtein = mealSlots.reduce((sum, key) => {
        if (eatenMeals[key] && diet?.meals?.[key]) {
            return sum + parseNum(diet.meals[key].protein);
        }
        return sum;
    }, 0);

    const allComplete = eatenCount >= totalMeals;
    const suppCount = Array.isArray(diet?.supplements) ? diet.supplements.length : 0;
    const takenSuppCount = Object.keys(takenSupps).length;
    const allSuppsComplete = suppCount > 0 ? takenSuppCount >= suppCount : true;
    const dayComplete = allComplete && allSuppsComplete;

    // Increment streak only when EVERYTHING (meals + supplements) is done
    useEffect(() => {
        if (dayComplete && !streakBumped) {
            setStreak(prev => prev + 1);
            setStreakBumped(true);
        }
    }, [dayComplete, streakBumped]);

    if (!diet) return (
        <div style={{
            padding: '80px 40px',
            textAlign: 'center',
            animation: 'fadeIn 0.5s ease'
        }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>🥗</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#BB86FC', marginBottom: '8px' }}>
                Generating Your Personalized Diet...
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                Calculating targets from your profile and crafting meals
            </div>
        </div>
    );

    const { macroTargets, strategy, focusPoints, meals, supplements: supps, disclaimer, reassurance } = diet;

    // Calculate targets FROM the actual meals (so eaten always sums to 100%)
    const targetCals = mealSlots.reduce((sum, key) => {
        if (diet?.meals?.[key]) return sum + parseNum(diet.meals[key].cals);
        return sum;
    }, 0) || parseNum(macroTargets?.cals) || 2200;

    const targetProtein = mealSlots.reduce((sum, key) => {
        if (diet?.meals?.[key]) return sum + parseNum(diet.meals[key].protein);
        return sum;
    }, 0) || parseNum(macroTargets?.protein) || 140;

    const calPercent = Math.min((consumedCals / targetCals) * 100, 100);
    const proteinPercent = Math.min((consumedProtein / targetProtein) * 100, 100);

    // Accent color shifts when day is complete
    const accent = dayComplete ? '#4CAF50' : '#BB86FC';
    const accentGlow = dayComplete ? 'rgba(76,175,80,0.1)' : 'rgba(155,108,255,0.1)';

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.5s', transition: 'all 0.5s ease' }}>

            {/* FULL DAY COMPLETE HERO BANNER */}
            {dayComplete && !transitioning && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(76,175,80,0.12) 0%, rgba(129,199,132,0.06) 50%, rgba(76,175,80,0.12) 100%)',
                    border: '1px solid rgba(76,175,80,0.25)',
                    borderRadius: '20px',
                    padding: '40px',
                    marginBottom: '40px',
                    textAlign: 'center',
                    animation: 'fadeIn 0.6s ease',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏆</div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#4CAF50', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                            Day Complete!
                        </h2>
                        <p style={{ color: '#81C784', fontSize: '1rem', margin: '0 0 20px', maxWidth: '500px', marginInline: 'auto' }}>
                            All meals eaten. All supplements taken. You’re building momentum.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '16px', marginBottom: '28px' }}>
                            <div>
                                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff' }}>{consumedCals}</div>
                                <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>kcal eaten</div>
                            </div>
                            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <div>
                                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff' }}>{consumedProtein}g</div>
                                <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>protein</div>
                            </div>
                            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <div>
                                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#FF9800' }}>🔥 {streak}</div>
                                <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>day streak</div>
                            </div>
                        </div>

                        {/* PROCEED TO NEXT DAY BUTTON */}
                        <button
                            onClick={proceedToNextDay}
                            style={{
                                background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                                color: '#fff',
                                border: 'none',
                                padding: '14px 36px',
                                borderRadius: '30px',
                                fontSize: '0.95rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                letterSpacing: '0.5px',
                                boxShadow: '0 6px 20px rgba(76,175,80,0.4)',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseOver={(e) => {
                                e.target.style.transform = 'scale(1.05)';
                                e.target.style.boxShadow = '0 8px 25px rgba(76,175,80,0.5)';
                            }}
                            onMouseOut={(e) => {
                                e.target.style.transform = 'scale(1)';
                                e.target.style.boxShadow = '0 6px 20px rgba(76,175,80,0.4)';
                            }}
                        >
                            ➡ Proceed to Next Day’s Diet
                        </button>
                    </div>
                </div>
            )}

            {/* TRANSITIONING STATE */}
            {transitioning && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(187,134,252,0.1) 0%, rgba(156,39,176,0.05) 100%)',
                    border: '1px solid rgba(187,134,252,0.2)',
                    borderRadius: '20px',
                    padding: '60px 40px',
                    marginBottom: '40px',
                    textAlign: 'center',
                    animation: 'fadeIn 0.4s ease'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>🥗</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#BB86FC', margin: '0 0 8px' }}>
                        Generating your next day’s plan...
                    </h2>
                    <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
                        AI is crafting a fresh, personalized diet based on your profile.
                    </p>
                </div>
            )}

            {/* 1. HEADER */}
            <div style={{
                marginBottom: '40px',
                paddingBottom: '24px',
                borderBottom: `1px solid ${dayComplete ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)'} `,
                transition: 'all 0.5s ease'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Diet & Nutrition</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.95rem', color: '#888' }}>Personalized Strategy</span>
                            <span style={{ width: '4px', height: '4px', background: '#444', borderRadius: '50%' }}></span>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {/* Phase label badge */}
                                {diet?.phaseLabel && (
                                    <span style={{
                                        background: 'linear-gradient(135deg, rgba(187,134,252,0.15), rgba(156,39,176,0.1))',
                                        color: '#BB86FC',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        letterSpacing: '0.3px',
                                        border: '1px solid rgba(187,134,252,0.3)'
                                    }}>{diet.phaseEmoji} {diet.phaseLabel}</span>
                                )}
                                <span style={{
                                    background: accentGlow,
                                    color: accent,
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    letterSpacing: '0.5px'
                                }}>{dayComplete ? '✓ COMPLETE' : (context.goal || '').toUpperCase()}</span>
                                {context.diet_type && context.diet_type.trim() !== '' && (
                                    <span style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#ccc',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem'
                                    }}>{context.diet_type}</span>
                                )}
                                {/* Meal count badge */}
                                {diet?.mealCount && (
                                    <span style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: '#888',
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        fontSize: '0.72rem'
                                    }}>{diet.mealCount} meals/day</span>
                                )}
                            </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: dayComplete ? '#4CAF50' : '#666', margin: 0, fontStyle: 'italic', maxWidth: '600px', transition: 'color 0.5s ease' }}>
                            {dayComplete
                                ? "You've completed today's nutrition plan. Rest, recover, come back stronger."
                                : "This plan adapts to your profile. Mark meals as eaten to track your daily progress."
                            }
                        </p>
                    </div>

                    {/* STREAK BADGE */}

                </div>
            </div>

            {/* 3. INTELLIGENT STRATEGY CARD */}
            <div style={{
                background: 'linear-gradient(145deg, #1A1A1A 0%, #121212 100%)',
                border: '1px solid #2a2a2a',
                borderRadius: '16px',
                padding: '32px',
                marginBottom: '56px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: '0 0 24px 0', fontWeight: '600' }}>Nutrition Strategy</h3>

                    {typeof strategy === 'string' ? (
                        <p style={{ color: '#aaa', fontSize: '1rem', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-line' }}>
                            {strategy.replace(". ", ".\n\n")}
                        </p>
                    ) : (
                        <div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {strategy?.bullets && strategy.bullets.map((bullet, i) => (
                                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#eee', fontSize: '0.95rem', fontWeight: '500' }}>
                                        <span style={{ color: '#BB86FC', fontSize: '1rem', lineHeight: '1' }}>✔</span>
                                        {bullet}
                                    </li>
                                ))}
                            </ul>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '20px' }}></div>
                            <p style={{ color: '#aaa', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                                {strategy?.text}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. DAILY TARGETS */}
            <div style={{ marginBottom: '64px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '24px', fontWeight: '600' }}>Daily Targets</h4>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                }}>
                    <div style={{ background: '#161616', padding: '20px', borderRadius: '12px', border: '1px solid #222' }}>
                        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '4px' }}>Calories</div>
                        <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>{targetCals}</div>
                        <div style={{ color: '#666', fontSize: '0.75rem', lineHeight: '1.4' }}>Supports training without excess fat gain</div>
                    </div>
                    <div style={{ background: '#161616', padding: '20px', borderRadius: '12px', border: '1px solid #222' }}>
                        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '4px' }}>Protein</div>
                        <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>{targetProtein}g</div>
                        <div style={{ color: '#666', fontSize: '0.75rem', lineHeight: '1.4' }}>Preserves lean mass & recovery</div>
                    </div>
                    <div style={{ background: '#161616', padding: '20px', borderRadius: '12px', border: '1px solid #222' }}>
                        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '4px' }}>Daily Meals</div>
                        <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>4</div>
                        <div style={{ color: '#666', fontSize: '0.75rem', lineHeight: '1.4' }}>Balances energy & digestion</div>
                    </div>
                </div>

                {macroTargets?.logic && (
                    <div style={{ marginBottom: '20px' }}>
                        <p style={{ color: '#BB86FC', fontSize: '0.95rem', lineHeight: '1.6', opacity: 0.9, background: 'rgba(187, 134, 252, 0.05)', padding: '16px', borderRadius: '8px', borderLeft: '3px solid #BB86FC', marginBottom: '12px' }}>
                            {macroTargets.logic}
                        </p>
                    </div>
                )}
            </div>

            {/* Safety Note Banner */}
            {diet?.safetyNote && (
                <div style={{
                    background: 'rgba(255, 152, 0, 0.08)',
                    border: '1px solid rgba(255, 152, 0, 0.3)',
                    borderRadius: '12px', padding: '16px 20px',
                    marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <span style={{ fontSize: '0.9rem', color: '#FFB74D', fontWeight: '500' }}>{diet.safetyNote}</span>
                </div>
            )}

            {/* 5. DAILY PROTOCOL — WITH MARK AS EATEN */}
            <div style={{ marginBottom: '64px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '24px', fontWeight: '600' }}>Daily Protocol</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {(() => {
                        const SLOT_META = {
                            breakfast: { color: '#FFB74D', icon: '🌅' },
                            mid_morning: { color: '#F48FB1', icon: '🍎' },
                            lunch: { color: '#81C784', icon: '☀️' },
                            snack: { color: '#FF8A65', icon: '⚡' },
                            dinner: { color: '#4DB6AC', icon: '🌙' },
                            bedtime: { color: '#9575CD', icon: '🌛' }
                        };

                        return Object.entries(meals || {}).map(([key, meal]) => {
                            const meta = SLOT_META[key] || { color: '#BB86FC', icon: '🍽️' };
                            const slotLabel = meal.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                            const isEaten = eatenMeals[key];
                            const isAnimating = animatingMeal === key;

                            return (
                                <div key={key} style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(140px, 15%) 1fr auto',
                                    gap: '24px',
                                    alignItems: 'start',
                                    background: isEaten ? 'rgba(76, 175, 80, 0.04)' : '#161616',
                                    border: `1px solid ${isEaten ? 'rgba(76, 175, 80, 0.2)' : '#222'}`,
                                    borderRadius: '16px',
                                    padding: '32px',
                                    transition: 'all 0.4s ease',
                                    transform: isAnimating ? 'scale(1.01)' : 'scale(1)',
                                    opacity: isEaten ? 0.85 : 1
                                }}>
                                    {/* Time/Type */}
                                    <div style={{ fontSize: '0.9rem', color: '#888', fontWeight: '500', display: 'flex', alignItems: 'center', paddingTop: '4px' }}>
                                        <span style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: isEaten ? '#4CAF50' : meta.color,
                                            marginRight: '12px',
                                            boxShadow: `0 0 8px ${isEaten ? '#4CAF50' : meta.color}`
                                        }}></span>
                                        <span>{meta.icon} {slotLabel}</span>
                                    </div>

                                    {/* Content */}
                                    <div>
                                        <div style={{
                                            fontSize: '1.25rem', fontWeight: '700',
                                            color: isEaten ? '#4CAF50' : '#fff',
                                            marginBottom: '8px', letterSpacing: '-0.01em',
                                            textDecoration: isEaten ? 'line-through' : 'none',
                                            textDecorationColor: 'rgba(76,175,80,0.4)'
                                        }}>
                                            {isEaten && <span style={{ marginRight: '8px' }}>✓</span>}
                                            {meal.name}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: '#888', lineHeight: '1.6', paddingLeft: '12px', borderLeft: '2px solid #333' }}>
                                            {meal.purpose}
                                        </div>
                                    </div>

                                    {/* Right: Macros + Button */}
                                    <div style={{ textAlign: 'right', minWidth: '120px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '1rem', color: '#eee', fontWeight: '700', marginBottom: '4px' }}>{meal.cals}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>kcal</div>
                                            <div style={{ fontSize: '1rem', color: '#eee', fontWeight: '700', marginTop: '12px', marginBottom: '4px' }}>{meal.protein}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>Protein</div>
                                        </div>

                                        {/* MARK AS EATEN */}
                                        <button
                                            onClick={() => toggleMeal(key, meal)}
                                            style={{
                                                background: isEaten ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.04)',
                                                color: isEaten ? '#4CAF50' : '#aaa',
                                                border: `1.5px solid ${isEaten ? 'rgba(76,175,80,0.3)' : '#333'}`,
                                                padding: '8px 16px', borderRadius: '10px',
                                                fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                                                transition: 'all 0.25s ease', display: 'flex',
                                                alignItems: 'center', gap: '8px', whiteSpace: 'nowrap',
                                                transform: isAnimating ? 'scale(1.05)' : 'scale(1)'
                                            }}
                                            onMouseOver={(e) => { if (isEaten) { e.currentTarget.style.borderColor = '#ff4444'; e.currentTarget.style.color = '#ff4444'; } }}
                                            onMouseOut={(e) => { if (isEaten) { e.currentTarget.style.borderColor = 'rgba(76,175,80,0.3)'; e.currentTarget.style.color = '#4CAF50'; } }}
                                        >
                                            <span style={{
                                                width: '18px', height: '18px', borderRadius: '5px',
                                                border: `2px solid ${isEaten ? '#4CAF50' : '#555'}`,
                                                background: isEaten ? '#4CAF50' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.7rem', color: '#fff', flexShrink: 0, transition: 'all 0.25s ease'
                                            }}>{isEaten ? '✓' : ''}</span>
                                            {isEaten ? 'Eaten' : '🍽 Mark Eaten'}
                                        </button>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>

            </div>



    {/* 6. SYSTEM LOGIC */ }
    <div style={{ marginBottom: '80px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '32px', fontWeight: '600' }}>How This Plan Works</h4>
                <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px' }}>
                    {Array.isArray(focusPoints) && focusPoints.map((point, idx) => (
                        <div key={idx} style={{
                            background: '#1A1A1A',
                            padding: '40px',
                            borderRadius: '16px',
                            border: '1px solid #2a2a2a',
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '20px' }}>{point.icon}</div>
                            <h5 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 12px 0', fontWeight: '600' }}>{point.title}</h5>
                            <p style={{ fontSize: '0.95rem', color: '#888', margin: 0, lineHeight: '1.6', flex: 1 }}>{point.desc}</p>
                        </div>
                    ))}
                </div>
            </div >

    {/* 7. SUPPLEMENTS */ }
    < div style = {{ marginBottom: '80px' }}>
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '600' }}>Supplements</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#555', margin: 0 }}>These are supportive additions.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {Array.isArray(supps) && supps.map((s, i) => {
                        const name = typeof s === 'object' ? s.name : s;
                        const ctx = typeof s === 'object' ? s.context : "Recommended for your goal.";
                        const isTaken = takenSupps[i];

                        return (
                            <div key={i} style={{
                                background: isTaken ? 'rgba(76,175,80,0.04)' : 'rgba(255,255,255,0.02)',
                                padding: '24px',
                                borderRadius: '12px',
                                border: `1px solid ${isTaken ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.05)'} `,
                                transition: 'all 0.3s ease',
                                opacity: isTaken ? 0.85 : 1
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ color: isTaken ? '#4CAF50' : '#BB86FC', fontSize: '1.2rem' }}>{isTaken ? '✓' : '+'}</span>
                                            <span style={{
                                                color: isTaken ? '#4CAF50' : '#fff',
                                                fontWeight: '600',
                                                fontSize: '1rem',
                                                textDecoration: isTaken ? 'line-through' : 'none',
                                                textDecorationColor: 'rgba(76,175,80,0.4)'
                                            }}>{name}</span>
                                        </div>
                                        {/* DOSAGE DISPLAY */}
                                        {s.dosage && (
                                            <div style={{ fontSize: '0.8rem', color: '#BB86FC', marginLeft: '24px', marginTop: '2px', fontWeight: '500' }}>
                                                {s.dosage}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => toggleSupplement(i, s)}
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            minWidth: '28px',
                                            background: isTaken ? '#4CAF50' : 'transparent',
                                            color: isTaken ? '#fff' : '#555',
                                            border: `2px solid ${isTaken ? '#4CAF50' : '#444'} `,
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: 0,
                                            flexShrink: 0
                                        }}
                                    >
                                        {isTaken ? '✓' : ''}
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: '#888', margin: 0, lineHeight: '1.5', paddingLeft: '24px' }}>
                                    {ctx}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div >

    {/* 8. FOOTER */ }
    < div style = {{
    borderTop: '1px solid #222',
        paddingTop: '32px',
            display: 'flex',
                flexDirection: 'column',
                    alignItems: 'center'
}}>
    <p style={{ fontSize: '0.75rem', color: '#444', maxWidth: '500px', lineHeight: '1.5', textAlign: 'center' }}>
        {disclaimer ? disclaimer.replace("MEDICAL DISCLAIMER: ", "") : "Consult a qualified healthcare professional before starting any new diet."}
    </p>
            </div >
        </div >
    );
};

export default Diet;
