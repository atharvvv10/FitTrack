import React, { useState, useEffect } from 'react';
import { generateWorkout } from '../logic/workoutGenerator';
import { auth } from '../lib/firebase';
import { logWorkout } from '../services/userService';

// Reusable Filter Chip
// Reusable Filter Card
const FilterChip = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            background: active ? 'linear-gradient(145deg, rgba(138, 43, 226, 0.15), rgba(138, 43, 226, 0.05))' : '#1A1A1C',
            color: active ? '#BB86FC' : '#888',
            border: active ? '1px solid rgba(138, 43, 226, 0.5)' : '1px solid rgba(255,255,255,0.08)',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '0.9rem',
            fontWeight: active ? '700' : '600',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            boxShadow: active ? '0 0 30px rgba(138, 43, 226, 0.15)' : 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}
    >
        <span>{label}</span>
        {active && <span style={{ fontSize: '1.2rem' }}>•</span>}
    </button>
);

const Workouts = (props) => {
    const { context, initialLibrary = [], initialFilter } = props;
    const [filter, setFilter] = useState(initialFilter || 'Full Body');
    const [selectedWorkout, setSelectedWorkout] = useState(null);
    const [library, setLibrary] = useState([]);
    const [completedExercises, setCompletedExercises] = useState(new Set());
    const [expandedExercises, setExpandedExercises] = useState(new Set()); // New state
    const [showWarmup, setShowWarmup] = useState(false);
    const [showCooldown, setShowCooldown] = useState(false);
    const [sessionActive, setSessionActive] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showEndSessionModal, setShowEndSessionModal] = useState(false);
    const [selectedGuide, setSelectedGuide] = useState(null); // New state for How-To modal
    const [warmupCompleted, setWarmupCompleted] = useState(false);
    const [cooldownCompleted, setCooldownCompleted] = useState(false);
    const [rotationIndex, setRotationIndex] = useState(() => {
        return parseInt(localStorage.getItem('fittrack_rotation_index') || '0', 10);
    });
    const [todayFocusLabel, setTodayFocusLabel] = useState('');




    const exerciseRefs = React.useRef([]);

    // SIMULATED YOUTUBE API (Mapping for demo purposes)




    // Derived state for current active exercise
    const currentExerciseIndex = React.useMemo(() => {
        if (!selectedWorkout) return -1;
        return selectedWorkout.exercises.findIndex((_, idx) => !completedExercises.has(idx));
    }, [selectedWorkout, completedExercises]);

    // Auto-scroll effect
    useEffect(() => {
        if (sessionActive && currentExerciseIndex !== -1 && exerciseRefs.current[currentExerciseIndex]) {
            setTimeout(() => {
                exerciseRefs.current[currentExerciseIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 300); // Slight delay to allow for "Done" animation
        }
    }, [completedExercises.size, sessionActive, currentExerciseIndex]);

    useEffect(() => {
        let interval;
        if (sessionActive) {
            // Only tick if modal is NOT open (pause time while confirming)
            if (!showEndSessionModal) {
                interval = setInterval(() => {
                    setElapsedTime(prev => prev + 1);
                }, 1000);
            }
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [sessionActive, showEndSessionModal]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartSession = () => {
        if (sessionActive) {
            setShowEndSessionModal(true);
        } else {
            setSessionActive(true);
            setShowWarmup(true);
        }
    };

    const toggleExercise = (id) => {
        const next = new Set(completedExercises);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCompletedExercises(next);
    };

    const toggleExpand = (id) => {
        const next = new Set(expandedExercises);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedExercises(next);
    };

    const [allExercises, setAllExercises] = useState(initialLibrary);

    // Fetch Full Exercise Library from SQL (if not provided by parent)
    useEffect(() => {
        if (initialLibrary.length > 0) return;

        const fetchExercises = async () => {
            try {
                const res = await fetch('/api/exercises');
                if (res.ok) {
                    const data = await res.json();
                    console.log("✅ Fetched", data.length, "exercises");
                    setAllExercises(data);
                } else {
                    console.error("❌ Fetch failed:", res.status, res.statusText);
                }
            } catch (err) {
                console.error("❌ Failed to fetch exercise library:", err);
            }
        };
        fetchExercises();
    }, [initialLibrary]);

    // Mock generating a "Library" of workouts based on current context
    useEffect(() => {
        if (!context || allExercises.length === 0) return;


        // STRICT USER REQUEST: Only these categories
        const categories = ['Full Body', 'Upper Body', 'Lower Body', 'Cardio', 'Recovery Friendly'];

        // Generate TWO variations for each category so we always have an "Other Option"
        // Variation A (Primary) & Variation B (Alternative)
        const generatedA = categories.map(cat => generateWorkout(context, [], cat === 'Recovery Friendly' ? 'Mobility' : cat, allExercises));
        const generatedB = categories.map(cat => ({
            ...generateWorkout(context, [], cat === 'Recovery Friendly' ? 'Mobility' : cat, allExercises),
            title: `${cat} ${cat === 'Cardio' ? 'Endurance' : 'Variation'}` // Distinct title to differentiate
        }));

        const allGenerated = [...generatedA, ...generatedB];

        // ROTATION based on persisted index (advances when user clicks OK on end session)
        const rotationOrder = ['Upper Body', 'Lower Body', 'Cardio', 'Full Body', 'Recovery Friendly'];
        const todayFocus = rotationOrder[rotationIndex % rotationOrder.length];
        setTodayFocusLabel(todayFocus);

        // Find which generated workout matches today's focus (from Set A), put it first
        const todayIndex = categories.indexOf(todayFocus);
        const heroWorkout = { ...generatedA[todayIndex >= 0 ? todayIndex : 0], tags: [todayFocus] };

        // Build library: hero first, then the rest (excluding the specific hero object to avoid duplicate)
        // We include ALL of generatedB (alternatives) and the rest of generatedA
        const othersA = generatedA.filter((_, i) => i !== (todayIndex >= 0 ? todayIndex : 0));
        setLibrary([heroWorkout, ...othersA, ...generatedB]);
    }, [context, allExercises, rotationIndex]);

    const filteredLibrary = library.filter(w => {
        if (filter === 'Quick (≤30 min)') return parseInt(w.totalDuration) <= 30;
        if (filter === 'Recovery-friendly') return w.title.includes('Mobility') || w.difficulty === 'Light';
        if (filter === 'Full Body') return w.tags.includes('Full Body');
        if (filter === 'Upper Body') return w.tags.includes('Upper Body');
        if (filter === 'Lower Body') return w.tags.includes('Lower Body');
        if (filter === 'Cardio') return w.tags.includes('Cardio');
        return true;
    });

    // DETAIL VIEW
    if (selectedWorkout) {
        return (
            <div className="workout-detail" style={{ maxWidth: '800px', margin: '0 auto', width: '100%', padding: '0 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>

                    {/* STICKY HEADER */}
                    <div style={{
                        // position: 'sticky',  <-- REMOVED per user request
                        // top: 0,
                        // zIndex: 100,
                        // background: 'rgba(5, 5, 7, 0.95)',
                        // backdropFilter: 'blur(12px)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        padding: '20px 0',
                        marginBottom: '32px'
                    }}>
                        <button onClick={() => {
                            if (sessionActive) {
                                if (window.confirm("End current session and go back?")) {
                                    setSessionActive(false);
                                    setSelectedWorkout(null);
                                }
                            } else {
                                setSelectedWorkout(null);
                            }
                        }} style={{
                            background: 'transparent',
                            color: '#888',
                            padding: '0',
                            marginBottom: '16px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            opacity: sessionActive ? 0.5 : 1, // Visual hint that it's "locked"
                            transition: 'opacity 0.2s'
                        }}>
                            ← Back to Library
                        </button>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '16px', marginBottom: '24px' }}>
                                    <h1 style={{ fontSize: '1.8rem', margin: '0', lineHeight: '1.2', fontWeight: '800' }}>{selectedWorkout.title}</h1>
                                    <button
                                        onClick={handleStartSession}
                                        style={{
                                            padding: '10px 20px',
                                            background: sessionActive ? 'rgba(255, 59, 48, 0.12)' : '#fff',
                                            color: sessionActive ? '#FF3B30' : '#111',
                                            border: sessionActive ? '1px solid rgba(255, 59, 48, 0.4)' : 'none',
                                            borderRadius: '10px',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            boxShadow: sessionActive ? 'none' : '0 2px 8px rgba(255,255,255,0.1)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s ease',
                                        }}>
                                        {sessionActive ? '⏹ End Session' : '▶ Start Session'}
                                    </button>
                                </div>
                                {sessionActive && (
                                    <div style={{
                                        color: '#4CAF50',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        animation: 'fadeIn 0.5s ease'
                                    }}>
                                        <span style={{ fontSize: '0.8rem' }}>🟢</span> Session in progress
                                    </div>
                                )}

                                {sessionActive && (
                                    <div style={{
                                        marginBottom: '14px',
                                        padding: '12px 16px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        animation: 'fadeIn 0.5s ease'
                                    }}>
                                        {/* Timer + Target inline */}
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '10px', fontFamily: 'monospace' }}>
                                            <span style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '1px' }}>{formatTime(elapsedTime)}</span>
                                            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.9rem' }}>/</span>
                                            <span style={{ color: '#777', fontSize: '0.95rem' }}>~{selectedWorkout.totalDuration}</span>
                                        </div>

                                        {/* Progress Bar */}
                                        {(() => {
                                            const plannedMin = parseInt(selectedWorkout.totalDuration) || 45;
                                            const plannedSec = plannedMin * 60;
                                            const progress = Math.min((elapsedTime / plannedSec) * 100, 100);
                                            const isOver = elapsedTime > plannedSec;

                                            return (
                                                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${progress}%`,
                                                        height: '100%',
                                                        background: isOver
                                                            ? 'linear-gradient(90deg, #FF9800, #FF5722)'
                                                            : 'linear-gradient(90deg, #BB86FC, #7c4dff)',
                                                        borderRadius: '2px',
                                                        transition: 'width 1s linear'
                                                    }}></div>
                                                </div>
                                            );
                                        })()}

                                        {/* Over-time message */}
                                        {(() => {
                                            const plannedMin = parseInt(selectedWorkout.totalDuration) || 45;
                                            const plannedSec = plannedMin * 60;
                                            if (elapsedTime > plannedSec) {
                                                return (
                                                    <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#FF9800' }}>
                                                        🔥 Past target — keep going!
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                )}

                                {sessionActive && (
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                                        <div
                                            onClick={() => setWarmupCompleted(!warmupCompleted)}
                                            style={{
                                                background: warmupCompleted ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                                border: warmupCompleted ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '8px',
                                                padding: '5px 10px',
                                                fontSize: '0.8rem',
                                                color: warmupCompleted ? '#4CAF50' : '#888',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {warmupCompleted ? '✅' : '○'} Warm-up
                                        </div>
                                        <div
                                            onClick={() => setCooldownCompleted(!cooldownCompleted)}
                                            style={{
                                                background: cooldownCompleted ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                                border: cooldownCompleted ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '8px',
                                                padding: '5px 10px',
                                                fontSize: '0.8rem',
                                                color: cooldownCompleted ? '#4CAF50' : '#888',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {cooldownCompleted ? '✅' : '○'} Cool-down
                                        </div>
                                    </div>
                                )}

                                {/* Info Bar — pill badges */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                    // marginTop removed in favor of header marginBottom
                                }}>
                                    {/* Duration pill */}
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: 'rgba(187, 134, 252, 0.1)',
                                        border: '1px solid rgba(187, 134, 252, 0.2)',
                                        color: '#BB86FC', fontSize: '0.78rem', fontWeight: '600',
                                        padding: '4px 10px', borderRadius: '6px'
                                    }}>
                                        ⏱ {selectedWorkout.totalDuration || '45 min'}
                                    </span>

                                    {/* Tags */}
                                    {selectedWorkout.tags?.filter(tag => tag && tag.trim()).map((tag, i) => (
                                        <span key={i} style={{
                                            display: 'inline-flex', alignItems: 'center',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            color: '#bbb', fontSize: '0.78rem', fontWeight: '500',
                                            padding: '4px 10px', borderRadius: '6px'
                                        }}>
                                            {tag}
                                        </span>
                                    ))}

                                    {/* Difficulty pill */}
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: 'rgba(255, 193, 7, 0.08)',
                                        border: '1px solid rgba(255, 193, 7, 0.15)',
                                        color: '#FFC107', fontSize: '0.78rem', fontWeight: '600',
                                        padding: '4px 10px', borderRadius: '6px'
                                    }}>
                                        ⚡ {selectedWorkout.difficulty || 'Intermediate'}
                                    </span>

                                    {/* Equipment pill */}
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                        color: '#888', fontSize: '0.78rem', fontWeight: '500',
                                        padding: '4px 10px', borderRadius: '6px'
                                    }}>
                                        🏋️ {selectedWorkout.equipmentLabel || 'Bodyweight'}
                                    </span>
                                </div>
                            </div>


                        </div>
                    </div>

                    {/* COLLAPSIBLE WARMUP */}
                    <div style={{ marginBottom: '24px' }}>
                        <button
                            onClick={() => setShowWarmup(!showWarmup)}
                            style={{
                                width: '100%',
                                padding: '16px 24px',
                                background: 'linear-gradient(90deg, rgba(255, 165, 0, 0.15), rgba(255, 165, 0, 0.05))',
                                border: '1px solid rgba(255, 165, 0, 0.3)',
                                borderRadius: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                color: '#FFD700',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span>{warmupCompleted ? '✅' : '🔥'} Warm Up</span>
                                <span style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 'normal' }}>
                                    ({selectedWorkout.warmup.reduce((acc, w) => acc + parseInt(w.duration), 0)} min)
                                </span>
                            </div>
                            <span style={{ transform: showWarmup ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                        </button>

                        {showWarmup && (
                            <div style={{
                                marginTop: '8px',
                                background: 'rgba(20, 20, 20, 0.5)',
                                padding: '20px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 165, 0, 0.1)'
                            }}>
                                <ul style={{ paddingLeft: '20px', color: '#ccc', margin: 0 }}>
                                    {selectedWorkout.warmup.map((w, i) => (
                                        <li key={i} style={{ marginBottom: '8px' }}>
                                            <span style={{ color: '#fff', fontWeight: 'bold' }}>{w.name}</span> <span style={{ color: '#888' }}>({w.duration})</span>
                                        </li>
                                    ))}
                                </ul>
                                <div style={{ marginTop: '20px', padding: '0 10px' }}>
                                    <button
                                        disabled={!sessionActive}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!warmupCompleted) {
                                                setWarmupCompleted(true);
                                                setShowWarmup(false);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            background: warmupCompleted ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 165, 0, 0.2)',
                                            border: warmupCompleted ? '1px solid rgba(76, 175, 80, 0.5)' : '1px solid rgba(255, 165, 0, 0.5)',
                                            borderRadius: '8px',
                                            color: warmupCompleted ? '#4CAF50' : '#FFD700',
                                            fontWeight: 'bold',
                                            cursor: !sessionActive ? 'not-allowed' : 'pointer',
                                            opacity: !sessionActive ? 0.5 : 1,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        title={!sessionActive ? "Start session to track progress" : ""}
                                    >
                                        {warmupCompleted ? '✓ Warm-up Completed' : '✅ Mark as Complete'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MAIN WORKOUT */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ marginBottom: '16px' }}>Training Block</h3>
                        {selectedWorkout.exercises.map((ex, idx) => {
                            const isDone = completedExercises.has(idx);
                            const isExpanded = expandedExercises.has(idx);
                            const isCurrent = sessionActive && idx === currentExerciseIndex;
                            const isDisabled = !sessionActive;

                            return (
                                <div key={idx}
                                    ref={el => exerciseRefs.current[idx] = el}
                                    className="card"
                                    style={{
                                        marginBottom: '16px',
                                        background: isDone ? 'rgba(76, 175, 80, 0.08)' : isCurrent ? 'rgba(138, 43, 226, 0.08)' : '#1A1A1C',
                                        border: isDone ? '1px solid rgba(76, 175, 80, 0.3)' : isCurrent ? '1px solid #BB86FC' : isExpanded ? '1px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.08)',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        cursor: 'pointer',
                                        transform: isCurrent ? 'scale(1.02)' : 'scale(1)',
                                        boxShadow: isCurrent ? '0 8px 30px rgba(138, 43, 226, 0.15)' : 'none',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    onClick={(e) => {
                                        // Don't toggle expand if clicking a button
                                        if (e.target.tagName !== 'BUTTON') {
                                            toggleExpand(idx);
                                        }
                                    }}
                                >
                                    {/* Current Label Override */}
                                    {isCurrent && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '12px',
                                            right: '12px',
                                            background: '#BB86FC',
                                            color: '#000',
                                            fontSize: '0.7rem',
                                            fontWeight: 'bold',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            zIndex: 10,
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                        }}>
                                            Current Exercise
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {/* Row 1: Header & Meta */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ opacity: isDone ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: isDone ? '#4CAF50' : '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {isDone && <span>✅</span>}
                                                    {idx + 1}. {ex.name}
                                                </div>
                                                <div style={{ color: '#aaa', fontSize: '0.95rem' }}>
                                                    <span style={{ color: isDone ? '#66bb6a' : '#fff', fontWeight: '600' }}>{ex.sets} sets</span> × {ex.reps} • Rest: {ex.rest}
                                                </div>
                                            </div>
                                            {!isCurrent && !isDone && (
                                                <span style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.75rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                    color: '#888'
                                                }}>
                                                    {ex.difficulty}
                                                </span>
                                            )}
                                        </div>

                                        {/* Short Cue - Visible */}
                                        {!isDone && (
                                            <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                                "{ex.instruction}"
                                            </div>
                                        )}

                                        {/* EXPANDED CONTENT */}
                                        {isExpanded && (
                                            <div style={{
                                                marginTop: '8px',
                                                paddingTop: '16px',
                                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                                animation: 'fadeIn 0.3s ease'
                                            }}>
                                                <div style={{ marginBottom: '16px' }}>
                                                    <div style={{ fontWeight: 'bold', color: '#BB86FC', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase' }}>⚠ Common Mistakes</div>
                                                    <ul style={{ paddingLeft: '20px', color: '#ccc', margin: 0, fontSize: '0.95rem' }}>
                                                        {ex.mistakes && ex.mistakes.map((m, i) => <li key={i}>{m}</li>)}
                                                    </ul>
                                                </div>

                                                <div style={{ marginBottom: '16px' }}>
                                                    <div style={{ fontWeight: 'bold', color: '#03DAC6', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase' }}>⚡ Pro Tip</div>
                                                    <p style={{ color: '#bbb', margin: 0, fontSize: '0.95rem' }}>
                                                        Focus on the mind-muscle connection. Exhale on the exertion phrase.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Row 3: Actions */}
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px', opacity: isDisabled ? 0.5 : 1, transition: 'opacity 0.2s' }}
                                            title={isDisabled ? "Start session to track progress" : ""}>
                                            <button
                                                disabled={isDisabled}
                                                style={{
                                                    flex: 1,
                                                    padding: '12px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    color: isDisabled ? '#888' : '#fff',
                                                    fontSize: '0.9rem',
                                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                }} onClick={(e) => { e.stopPropagation(); setSelectedGuide(ex); }}>
                                                ▶ How to
                                            </button>

                                            <button
                                                disabled={isDisabled}
                                                style={{
                                                    flex: 1,
                                                    padding: '12px',
                                                    background: isDone ? '#4CAF50' : 'var(--accent-purple)',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    color: isDisabled ? 'rgba(255,255,255,0.5)' : '#fff',
                                                    fontWeight: '600',
                                                    fontSize: '0.9rem',
                                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    transition: 'all 0.2s',
                                                    boxShadow: isCurrent && !isDisabled ? '0 0 15px rgba(187, 134, 252, 0.4)' : 'none'
                                                }} onClick={(e) => { e.stopPropagation(); toggleExercise(idx); }}>
                                                {isDone ? '✓ Done' : 'Mark Done'}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Expand Arrow Indicator */}
                                    <div style={{ textAlign: 'center', marginTop: '12px', color: '#555', fontSize: '0.8rem' }}>
                                        {isExpanded ? '▲ Show Less' : '▼ Show Details'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* COLLAPSIBLE COOLDOWN */}
                    <div style={{ marginBottom: '64px' }}>
                        <button
                            onClick={() => setShowCooldown(!showCooldown)}
                            style={{
                                width: '100%',
                                padding: '16px 24px',
                                background: 'linear-gradient(90deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.05))',
                                border: '1px solid rgba(76, 175, 80, 0.3)',
                                borderRadius: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                color: '#81C784',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span>{cooldownCompleted ? '✅' : '❄️'} Cool Down</span>
                                <span style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 'normal' }}>
                                    ({selectedWorkout.cooldown.reduce((acc, w) => acc + parseInt(w.duration), 0)} min)
                                </span>
                            </div>
                            <span style={{ transform: showCooldown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                        </button>

                        {showCooldown && (
                            <div style={{
                                marginTop: '8px',
                                background: 'rgba(20, 20, 20, 0.5)',
                                padding: '20px',
                                borderRadius: '12px',
                                border: '1px solid rgba(76, 175, 80, 0.1)'
                            }}>
                                <ul style={{ paddingLeft: '20px', color: '#ccc', margin: 0 }}>
                                    {selectedWorkout.cooldown.map((w, i) => (
                                        <li key={i} style={{ marginBottom: '8px' }}>
                                            <span style={{ color: '#fff', fontWeight: 'bold' }}>{w.name}</span> <span style={{ color: '#888' }}>({w.duration})</span>
                                        </li>
                                    ))}
                                </ul>
                                <div style={{ marginTop: '20px', padding: '0 10px' }}>
                                    <button
                                        disabled={!sessionActive}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!cooldownCompleted) {
                                                setCooldownCompleted(true);
                                                setShowCooldown(false);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            background: cooldownCompleted ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)',
                                            border: '1px solid rgba(76, 175, 80, 0.5)',
                                            borderRadius: '8px',
                                            color: cooldownCompleted ? '#4CAF50' : '#81C784',
                                            fontWeight: 'bold',
                                            cursor: !sessionActive ? 'not-allowed' : 'pointer',
                                            opacity: !sessionActive ? 0.5 : 1,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        title={!sessionActive ? "Start session to track progress" : ""}
                                    >
                                        {cooldownCompleted ? '✓ Cool-down Completed' : '✅ Mark as Complete'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* END SESSION MODAL */}
                {
                    showEndSessionModal && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }} onClick={() => setShowEndSessionModal(false)}>
                            <div style={{
                                background: '#1E1E24', padding: '32px', borderRadius: '24px',
                                maxWidth: '400px', width: '90%', border: '1px solid rgba(255,255,255,0.1)',
                                textAlign: 'center'
                            }} onClick={e => e.stopPropagation()}>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>End workout?</h2>
                                <p style={{ color: '#aaa', marginBottom: '24px', lineHeight: '1.5' }}>
                                    You’ve completed <span style={{ color: '#fff', fontWeight: 'bold' }}>{completedExercises.size}</span> of {selectedWorkout.exercises.length} exercises.<br />
                                    {warmupCompleted && <span style={{ display: 'block', marginTop: '4px', fontSize: '0.9rem', color: '#4CAF50' }}>✓ Warm-up Completed</span>}
                                    {cooldownCompleted && <span style={{ display: 'block', marginTop: '4px', fontSize: '0.9rem', color: '#81C784' }}>✓ Cool-down Completed</span>}
                                    <br />
                                    Progress will be saved.
                                </p>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <button onClick={() => setShowEndSessionModal(false)} style={{
                                        flex: 1, padding: '16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                                        color: '#fff', borderRadius: '16px', cursor: 'pointer', fontSize: '1rem'
                                    }}>
                                        Continue
                                    </button>
                                    <button onClick={async () => {
                                        console.log("Attempting to save workout...");
                                        const user = auth.currentUser;
                                        console.log("Current user:", user ? user.uid : "NULL");

                                        if (user && selectedWorkout) {
                                            try {
                                                const result = await logWorkout(user.uid, {
                                                    title: selectedWorkout.title,
                                                    duration: elapsedTime,
                                                    exercisesTotal: selectedWorkout.exercises.length,
                                                    exercisesCompleted: completedExercises.size,
                                                    warmupCompleted,
                                                    cooldownCompleted,
                                                    difficulty: selectedWorkout.difficulty
                                                });
                                                console.log("Save result:", result);
                                                alert("Workout saved successfully! ✅");
                                            } catch (e) {
                                                console.error("SAVE ERROR:", e);
                                                alert("Error saving workout. Check console.");
                                            }
                                        } else {
                                            console.error("Cannot save: User not logged in.");
                                            alert("Error: You must be logged in to save progress.");
                                        }

                                        setSessionActive(false);
                                        setShowEndSessionModal(false);
                                        setCompletedExercises(new Set());
                                        setWarmupCompleted(false);
                                        setCooldownCompleted(false);
                                        setSelectedWorkout(null);

                                        // Ask to rotate schedule
                                        if (window.confirm("Great job! 💪\n\nWould you like to rotate your schedule to the next workout focus?")) {
                                            const nextIndex = rotationIndex + 1;
                                            setRotationIndex(nextIndex);
                                            localStorage.setItem('fittrack_rotation_index', String(nextIndex));
                                            if (props.onCompleteDay) props.onCompleteDay();
                                        }
                                    }} style={{
                                        flex: 1, padding: '16px', background: '#FF3B30', border: 'none',
                                        color: '#fff', borderRadius: '16px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem'
                                    }}>
                                        End Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* HOW-TO GUIDE MODAL */}
                {
                    selectedGuide && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                            zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '16px'
                        }} onClick={() => setSelectedGuide(null)}>
                            <div style={{
                                background: '#1E1E24', width: '100%', maxWidth: '600px',
                                borderRadius: '20px', overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                maxHeight: '85vh', display: 'flex', flexDirection: 'column'
                            }} onClick={e => e.stopPropagation()}>

                                {/* Header */}
                                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#151518' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{selectedGuide.name} Guide</h2>
                                    <button onClick={() => setSelectedGuide(null)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                                </div>

                                {/* Scrollable Content TIGHTER */}
                                <div style={{ padding: '0', overflowY: 'auto' }}>



                                    <div style={{ padding: '24px' }}>

                                        {/* 1. VISUALS (Images) */}
                                        {selectedGuide.image && (
                                            <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', overflowX: 'auto' }}>
                                                {/* Image 1 (Start) */}
                                                <div style={{ flex: 1, minWidth: '0', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#000' }}>
                                                    <img src={selectedGuide.image} alt={`${selectedGuide.name} start`} style={{ width: '100%', height: 'auto', display: 'block' }} />
                                                    {selectedGuide.image !== selectedGuide.gif && (
                                                        <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.8rem', color: '#888', background: '#1A1A1C' }}>Start</div>
                                                    )}
                                                </div>

                                                {/* Image 2 (End) - Only if different */}
                                                {selectedGuide.image !== selectedGuide.gif && selectedGuide.gif && (
                                                    <div style={{ flex: 1, minWidth: '0', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#000' }}>
                                                        <img src={selectedGuide.gif} alt={`${selectedGuide.name} end`} style={{ width: '100%', height: 'auto', display: 'block' }} />
                                                        <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.8rem', color: '#888', background: '#1A1A1C' }}>Finish</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 2. How to Perform - Primary Instruction */}
                                        <div style={{ marginBottom: '24px' }}>
                                            <h3 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>▶</span> HOW TO PERFORM
                                            </h3>
                                            <ol style={{ margin: 0, paddingLeft: '20px', color: '#ccc', lineHeight: '1.6', fontSize: '0.95rem' }}>
                                                {selectedGuide.steps && selectedGuide.steps.map((step, i) => (
                                                    <li key={i} style={{ marginBottom: '8px', paddingLeft: '8px' }}>{step}</li>
                                                ))}
                                            </ol>
                                        </div>

                                        {/* DIVIDER REMOVED per user request for continuity */}
                                        {/* <hr style={{ border: 'none', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '24px 0' }} /> */}

                                        {/* 3. Key Cues */}
                                        {selectedGuide.cues && selectedGuide.cues.length > 0 && (
                                            <div style={{ marginBottom: '24px' }}>
                                                <h3 style={{ fontSize: '0.9rem', color: '#BB86FC', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>✓</span> KEY CUES
                                                </h3>
                                                <ul style={{ margin: 0, paddingLeft: '20px', color: '#ddd', lineHeight: '1.6', fontSize: '0.95rem', listStyle: 'none' }}>
                                                    {selectedGuide.cues.map((cue, i) => (
                                                        <li key={i} style={{ marginBottom: '6px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                            <span style={{ color: '#BB86FC', fontWeight: 'bold' }}>✓</span>
                                                            {cue}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* 4. Mistakes */}
                                        {selectedGuide.mistakes && selectedGuide.mistakes.length > 0 && (
                                            <div style={{ marginBottom: '8px' }}>
                                                <h3 style={{ fontSize: '0.9rem', color: '#FF5252', marginBottom: '12px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', letterSpacing: '1px' }}>
                                                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠</span> AVOID THESE MISTAKES
                                                </h3>
                                                <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa', lineHeight: '1.6', fontSize: '0.95rem', listStyle: 'none' }}>
                                                    {selectedGuide.mistakes.map((m, i) => (
                                                        <li key={i} style={{ marginBottom: '6px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                            <span style={{ color: '#FF5252', fontWeight: 'bold' }}>⚠</span>
                                                            {m}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* DIVIDER */}
                                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', width: '100%' }}></div>

                                    {/* Footer */}
                                    <div style={{ padding: '20px 24px', background: '#151518', textAlign: 'center' }}>
                                        <button onClick={() => setSelectedGuide(null)} style={{
                                            width: '100%',
                                            padding: '14px', background: '#fff', color: '#000', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '1rem',
                                            boxShadow: '0 4px 15px rgba(255,255,255,0.1)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            marginBottom: '8px'
                                        }}>
                                            Back to Workout
                                        </button>
                                        <div style={{ color: '#666', fontSize: '0.85rem', fontWeight: '500' }}>
                                            You’ll resume where you left off
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        );
    }

    // LIBRARY VIEW
    return (
        <div style={{ maxWidth: '1120px', margin: '0 auto', width: '100%', padding: '0 24px' }}>
            {/* 1. HEADER */}
            <div style={{ marginBottom: '16px' }}>
                <h2 style={{ marginBottom: '2px', fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Today’s Training Recommendation</h2>
                <p style={{ color: '#888', margin: 0, fontSize: '0.9rem', maxWidth: '600px', fontStyle: 'italic', marginBottom: '12px' }}>
                    Generated based on your goal, recovery status, and recent activity.
                </p>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', width: '100%' }}></div>
            </div>

            {/* LOADING STATE - Pre-fetch */}
            {library.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    <h3>Loading Recommendations...</h3>
                    <p>Fetching {allExercises.length} exercises from database...</p>
                </div>
            )}


            {/* REST DAY CARD */}
            {library.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(66, 165, 245, 0.1) 0%, rgba(33, 150, 243, 0.05) 100%)',
                    border: '1px solid rgba(66, 165, 245, 0.3)',
                    borderRadius: '20px',
                    padding: '24px 32px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                    <div>
                        <h3 style={{ fontSize: '1.4rem', color: '#90CAF9', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1.8rem' }}>🛌</span> Need a Recovery Day?
                        </h3>
                        <p style={{ color: '#aaa', margin: 0, maxWidth: '500px' }}>
                            Listen to your body. Rest is when muscles grow. Mark today as a Rest Day to keep your streak alive without training.
                        </p>
                    </div>
                    <button
                        onClick={async () => {
                            if (!auth.currentUser) return;
                            if (!window.confirm("Confirm Rest Day? 💤")) return;
                            try {
                                await fetch('/api/workouts', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        userId: auth.currentUser.uid,
                                        title: "Rest Day",
                                        date: new Date().toISOString().split('T')[0],
                                        duration: 0,
                                        difficulty: "Rest",
                                        exercises: [],
                                        notes: "Rest Day"
                                    })
                                });
                                alert("Rest Day logged! Enjoy your recovery.");
                                setSelectedWorkout(null);
                            } catch (err) {
                                console.error("Failed to log rest day", err);
                            }
                        }}
                        style={{
                            background: '#1E1E24',
                            color: '#90CAF9',
                            border: '1px solid rgba(144, 202, 249, 0.5)',
                            padding: '12px 24px',
                            borderRadius: '30px',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={e => e.target.style.background = 'rgba(144, 202, 249, 0.1)'}
                        onMouseOut={e => e.target.style.background = '#1E1E24'}
                    >
                        💤 Log Rest Day
                    </button>
                </div>
            )}

            {/* 2. PRIMARY RECOMMENDATION (HERO CARD) */}
            {library.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(20, 20, 20, 0.5) 100%)',
                    border: '1px solid rgba(138, 43, 226, 0.4)',
                    borderRadius: '20px',
                    padding: '32px 24px',
                    minHeight: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    marginBottom: '32px',
                    position: 'relative',
                    boxShadow: '0 0 20px rgba(138, 43, 226, 0.1)',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                background: 'var(--accent-purple)', color: '#fff',
                                padding: '6px 12px', borderRadius: '8px',
                                fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '16px',
                                boxShadow: '0 2px 10px rgba(138, 43, 226, 0.3)'
                            }}>
                                🔥 {todayFocusLabel} Focus
                            </div>
                            <h3 style={{ fontSize: '2rem', marginBottom: '10px', lineHeight: '1.2', fontWeight: '800', letterSpacing: '-0.5px' }}>{library[0].title}</h3>
                            <p style={{ fontSize: '0.95rem', color: '#aaa', marginBottom: '20px', maxWidth: '600px', lineHeight: '1.5' }}>
                                Today’s scheduled {todayFocusLabel.toLowerCase()} session from your weekly rotation.
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '1rem', fontWeight: '500' }}>
                                    <span style={{ fontSize: '1.2rem' }}>⏱</span> {library[0].totalDuration}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '1rem', fontWeight: '500' }}>
                                    <span style={{ fontSize: '1.2rem' }}>⚡</span> {library[0].difficulty || 'Intensity High'}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedWorkout(library[0])}
                            style={{
                                background: '#fff', color: '#000',
                                border: 'none', padding: '12px 20px', borderRadius: '30px',
                                fontSize: '0.95rem', fontWeight: '800',
                                cursor: 'pointer', boxShadow: '0 4px 15px rgba(255,255,255,0.2)',
                                display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
                                whiteSpace: 'nowrap', height: 'fit-content'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            ▶ Start
                        </button>
                    </div>
                </div>
            )}

            {/* 3. OTHER OPTIONS */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '2.5rem', color: '#fff', marginBottom: '2px', fontWeight: '800', letterSpacing: '-0.02em' }}>Other Options</h3>
                <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '16px', opacity: 0.8, fontStyle: 'italic', marginTop: 0 }}>
                    Based on your recent activity and recovery, these sessions fit today best.
                </p>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '24px' }}></div>

                <div style={{ marginBottom: '12px', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '4px', background: 'var(--accent-purple)', borderRadius: '50%' }}></span>
                    Filter by Focus
                </div>

                <div className="grid">
                    {['Full Body', 'Upper Body', 'Lower Body', 'Cardio', 'Recovery-friendly'].map(f => (
                        <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
                    ))}
                </div>
            </div>

            {/* STRICT RESPONSIVE GRID via CSS Class, with inline gap safety */}
            <div className="premium-workout-grid" style={{
                gap: '32px', // Safety fallback matches CSS
                marginTop: '32px',
                width: '100%'
            }}>
                {filteredLibrary.filter(w => w !== library[0]).map((w, idx) => {
                    const description = w.title.includes('Full Body') ? "Improves full-body strength and conditioning while keeping recovery balanced."
                        : w.title.includes('Upper') ? "Focuses on upper body hypertrophy and foundational strength."
                            : w.title.includes('Lower') ? "Targeted lower body development for power, stability, and size."
                                : w.title.includes('Cardio') ? "High-intensity metabolic conditioning to boost endurance."
                                    : w.title.includes('Mobility') ? "Low-intensity active recovery to improve flexibility and reduce soreness."
                                        : w.title.includes('Core') ? "Targeted abdominal and lower back work for stability and power."
                                            : w.title.includes('Quick') ? "High-intensity interval training designed to maximize calorie burn in under 30 minutes."
                                                : w.title.includes('Quick') ? "High-intensity interval training designed to maximize calorie burn in under 30 minutes."
                                                    : "Optimized training session based on your current goal.";

                    // Micro-indicator Logic
                    let badgeLabel = "🔥 Great for today";
                    let badgeColor = "#FFD700"; // Gold
                    if (w.title.includes('Cardio') || w.title.includes('HIIT')) { badgeLabel = "⚡ High calorie burn"; badgeColor = "#FF3B30"; }
                    if (w.title.includes('Mobility') || w.difficulty === 'Light') { badgeLabel = "💤 Recovery-friendly"; badgeColor = "#4CAF50"; }
                    if (w.title.includes('Strength') || w.title.includes('Upper') || w.title.includes('Lower')) { badgeLabel = "💪 Strength Focus"; badgeColor = "#2196F3"; }

                    return (
                        <div key={idx} className="card"
                            style={{
                                background: '#1A1A1C',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '16px',
                                padding: '16px 12px',
                                cursor: 'default', // Changed from pointer since card isn't clickable
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                height: '100%',
                                minHeight: '260px', // Ensure minimum uniform height
                                marginBottom: '24px' // FORCE VERTICAL SPACING
                            }}
                            // onClick removed here
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.borderColor = 'rgba(138, 43, 226, 0.5)';
                                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {/* HEADER */}
                            <div>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fff', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.title}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: '#aaa' }}>
                                    <span>⏱ {w.totalDuration}</span>
                                    <span>•</span>
                                    <span>🔥 {w.difficulty || 'Moderate Intensity'}</span>
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>

                            {/* MICRO-INDICATOR */}
                            <div style={{
                                alignSelf: 'flex-start',
                                background: `${badgeColor}20`,
                                color: badgeColor,
                                border: `1px solid ${badgeColor}40`,
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                {badgeLabel}
                            </div>

                            {/* WHY */}
                            <div>
                                <h4 style={{ fontSize: '0.75rem', color: '#666', marginBottom: '6px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Why this workout?</h4>
                                <p style={{ color: '#ccc', margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
                                    {description}
                                </p>
                            </div>

                            {/* TARGETS */}
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: '0.75rem', color: '#666', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Targets</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {w.tags.filter(t => t).map(tag => (
                                        <span key={tag} style={{
                                            background: 'rgba(255,255,255,0.08)',
                                            color: '#ccc',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: '500'
                                        }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* INCLUDES */}
                            <div>
                                <h4 style={{ fontSize: '0.75rem', color: '#666', marginBottom: '6px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Includes</h4>
                                <div style={{ fontSize: '0.9rem', color: '#ccc' }}>
                                    ✔ {w.exercises.length} Exercises
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                                <button
                                    onClick={() => setSelectedWorkout(w)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: '#333',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.background = '#444'}
                                    onMouseOut={(e) => e.target.style.background = '#333'}
                                >
                                    Start Workout
                                </button>
                            </div>
                        </div>
                    );
                })}


            </div>
        </div>
    );
};

export default Workouts;
