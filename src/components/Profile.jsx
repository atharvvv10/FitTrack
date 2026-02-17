import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase'; // Import auth

const Profile = ({ context, setContext, onSave }) => {
    // Local state for some transient interactions
    const [progress, setProgress] = useState(0);
    const [saveMessage, setSaveMessage] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Get User Data
    const user = auth.currentUser;
    const name = user?.displayName || "FitTrack Member";
    const email = user?.email || "No email connected";
    const initial = name.charAt(0).toUpperCase();

    // Ensure context.allergies is always an array for this UI
    const currentAllergies = Array.isArray(context.allergies)
        ? context.allergies
        : (context.allergies && context.allergies !== 'None' ? [context.allergies] : []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setContext(prev => ({ ...prev, [name]: value }));
    };

    const updateField = (name, value) => {
        setContext(prev => ({ ...prev, [name]: value }));
    };

    // Toggle Allergy Logic
    const toggleAllergy = (label) => {
        let newAllergies = [];
        if (label === 'None') {
            newAllergies = ['None'];
        } else {
            // If selecting regular allergy, remove 'None'
            const baseList = currentAllergies.filter(a => a !== 'None');
            if (baseList.includes(label)) {
                newAllergies = baseList.filter(a => a !== label);
            } else {
                newAllergies = [...baseList, label];
            }
        }
        setContext(prev => ({ ...prev, allergies: newAllergies }));
    };

    const addCustomAllergy = (val) => {
        if (val && !currentAllergies.includes(val)) {
            const baseList = currentAllergies.filter(a => a !== 'None');
            setContext(prev => ({ ...prev, allergies: [...baseList, val] }));
        }
    };

    // Calculate profile completeness for "AI Confidence"
    useEffect(() => {
        let filled = 0;
        // goal, stats, level, workout_type, diet_type
        if (context.goal) filled++;
        if (context.stats) filled++;
        if (context.level) filled++;
        if (context.workout_type) filled++;
        if (context.diet_type) filled++;
        setProgress(Math.min(100, Math.round((filled / 5) * 100)));
    }, [context]);

    const GoalOptions = [
        { label: "Muscle Gain", icon: "💪" },
        { label: "Weight Loss", icon: "⚖️" },
        { label: "General Fitness", icon: "🏃" },
        { label: "Strength & Cond.", icon: "🏋️" }
    ];

    const DietOptions = ["Eggetarian", "Vegetarian", "Non-Vegetarian", "Vegan"];

    const AllergyOptions = [
        { label: "Nuts", icon: "🥜" },
        { label: "Dairy", icon: "🥛" },
        { label: "Gluten", icon: "🌾" },
        { label: "Soy", icon: "🫘" },
        { label: "None", icon: "🛡️" }
    ];

    const activeStyle = isEditing ? {
        borderColor: 'rgba(138, 43, 226, 0.4)',
        boxShadow: '0 0 20px rgba(138, 43, 226, 0.05)',
        background: 'linear-gradient(145deg, #232325, #1c1c1e)' // Slightly lighter
    } : {};

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
            <header style={{ textAlign: 'left', marginBottom: '40px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 className="display-text" style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Profile & Preferences</h1>
                <p style={{ fontSize: '0.85rem', color: '#666', margin: 0, fontStyle: 'italic', maxWidth: '600px' }}>
                    Manage the information FitTrack uses to personalize your training, nutrition, and recovery.
                </p>
            </header>

            {/* NEW: IDENTITY CARD */}
            <div className="premium-card" style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                    width: '60px', height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-purple), #a855f7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', fontWeight: 'bold', color: '#fff',
                    boxShadow: '0 4px 15px rgba(138, 43, 226, 0.4)'
                }}>
                    {initial}
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{name}</h3>
                    <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.9rem' }}>{email}</p>
                </div>
            </div>

            {/* CARD 1: TRAINING GOAL */}
            <div className="premium-card" style={{ marginBottom: '48px', ...activeStyle, transition: 'all 0.3s ease' }}>
                <h3 style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem', color: '#888', marginBottom: '20px' }}>
                    🧠 Training Goal
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                    {GoalOptions.map(opt => (
                        <div
                            key={opt.label}
                            onClick={() => isEditing && updateField('goal', opt.label)}
                            className={`selection-card ${context.goal === opt.label ? 'selected' : ''}`}
                            style={{
                                padding: '20px',
                                textAlign: 'center',
                                cursor: isEditing ? 'pointer' : 'default',
                                border: context.goal === opt.label ? '1px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.1)',
                                background: context.goal === opt.label ? 'rgba(138, 43, 226, 0.1)' : 'rgba(255,255,255,0.03)',
                                borderRadius: '12px',
                                transition: 'all 0.2s ease',
                                opacity: !isEditing && context.goal !== opt.label ? 0.5 : 1
                            }}
                        >
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{opt.icon}</div>
                            <div style={{ fontWeight: '600', color: context.goal === opt.label ? '#fff' : '#ccc' }}>{opt.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CARD 2: BODY & EXPERIENCE */}
            <div className="premium-card" style={{ marginBottom: '48px', ...activeStyle, transition: 'all 0.3s ease' }}>
                <h3 style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem', color: '#888', marginBottom: '20px' }}>
                    🏋️ Body & Experience
                </h3>

                {/* Stats Row - SPLIT */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div>
                        <label style={{ display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '0.9rem' }}>Height (cm)</label>
                        <input
                            className="input-field"
                            type="number"
                            name="height"
                            value={context.height || ''}
                            onChange={handleChange}
                            placeholder="175"
                            style={{ fontFamily: 'monospace', opacity: isEditing ? 1 : 0.7 }}
                            disabled={!isEditing}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '0.9rem' }}>Weight (kg)</label>
                        <input
                            className="input-field"
                            type="number"
                            name="weight"
                            value={context.weight || ''}
                            onChange={handleChange}
                            placeholder="70"
                            style={{ fontFamily: 'monospace', opacity: isEditing ? 1 : 0.7 }}
                            disabled={!isEditing}
                        />
                    </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '-16px', marginBottom: '24px' }}>Used to calculate caloric needs and load capacity.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Experience */}
                    <div>
                        <label style={{ display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '0.9rem' }}>Experience Level</label>
                        <select
                            className="input-field"
                            name="level"
                            value={context.level}
                            onChange={handleChange}
                            style={{ cursor: isEditing ? 'pointer' : 'default', opacity: isEditing ? 1 : 0.7 }}
                            disabled={!isEditing}
                        >
                            <option>Beginner</option>
                            <option>Intermediate</option>
                            <option>Advanced</option>
                        </select>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '6px' }}>This helps the AI adjust volume, intensity, and active recovery.</p>
                    </div>

                    {/* Location */}
                    <div>
                        <label style={{ display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '0.9rem' }}>Training Location</label>
                        <select
                            className="input-field"
                            name="workout_type"
                            value={context.workout_type}
                            onChange={handleChange}
                            style={{ cursor: isEditing ? 'pointer' : 'default', opacity: isEditing ? 1 : 0.7 }}
                            disabled={!isEditing}
                        >
                            <option>Gym</option>
                            <option>Home</option>
                        </select>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '6px' }}>Used to select exercises you actually have access to.</p>
                    </div>
                </div>
            </div>

            {/* CARD 3: LIFESTYLE & DIET */}
            <div className="premium-card" style={{ marginBottom: '56px', ...activeStyle, transition: 'all 0.3s ease' }}>
                <h3 style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem', color: '#888', marginBottom: '20px' }}>
                    🥗 Lifestyle & Diet
                </h3>

                <div style={{ marginBottom: '32px' }}>
                    <label style={{ display: 'block', color: '#ccc', marginBottom: '12px', fontSize: '0.9rem' }}>Diet Preference</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {DietOptions.map(opt => (
                            <button
                                key={opt}
                                onClick={() => updateField('diet_type', opt)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: context.diet_type === opt ? '1px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.1)',
                                    background: context.diet_type === opt ? 'rgba(138, 43, 226, 0.15)' : 'transparent',
                                    color: context.diet_type === opt ? '#fff' : '#888',
                                    cursor: isEditing ? 'pointer' : 'default',
                                    fontWeight: '500',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s',
                                    opacity: !isEditing && context.diet_type !== opt ? 0.5 : 1
                                }}
                                disabled={!isEditing}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', color: '#ccc', marginBottom: '16px', fontSize: '0.9rem' }}>Allergies & Restrictions</label>

                    {/* Allergy Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        {AllergyOptions.map(opt => {
                            const isSelected = currentAllergies.includes(opt.label);
                            return (
                                <div
                                    key={opt.label}
                                    onClick={() => isEditing && toggleAllergy(opt.label)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: isSelected ? '1px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.1)',
                                        background: isSelected ? 'rgba(138, 43, 226, 0.1)' : 'rgba(255,255,255,0.03)',
                                        textAlign: 'center',
                                        cursor: isEditing ? 'pointer' : 'default',
                                        color: isSelected ? '#fff' : '#888',
                                        transition: 'all 0.2s',
                                        opacity: !isEditing && !isSelected ? 0.5 : 1
                                    }}
                                >
                                    <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{opt.icon}</div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: '500' }}>{opt.label}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Custom Input */}
                    {isEditing && (
                        <input
                            className="input-field"
                            type="text"
                            placeholder="Add other (type and press Enter)"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    addCustomAllergy(e.currentTarget.value);
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    )}

                    {/* Selected Custom Tags */}
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {currentAllergies.filter(a => !AllergyOptions.map(o => o.label).includes(a) && a !== 'None').map(a => (
                            <span key={a} style={{
                                background: 'rgba(138, 43, 226, 0.2)',
                                color: '#d8b4fe',
                                padding: '4px 12px',
                                borderRadius: '16px',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                border: '1px solid rgba(138, 43, 226, 0.3)'
                            }}>
                                {a}
                                {isEditing && (
                                    <span
                                        style={{ cursor: 'pointer', opacity: 0.7, fontWeight: 'bold' }}
                                        onClick={() => toggleAllergy(a)}
                                    >×</span>
                                )}
                            </span>
                        ))}
                    </div>

                    <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>We’ll avoid unsafe foods automatically.</p>
                </div>
            </div>

            {/* CTA SECTION - Anchored Action Card */}
            {!isEditing ? (
                <div style={{ marginTop: '48px', textAlign: 'center' }}>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="btn btn-primary"
                        style={{
                            width: 'auto',
                            padding: '16px 48px',
                            fontSize: '1rem',
                            background: 'linear-gradient(90deg, var(--accent-purple) 0%, #a855f7 100%)',
                            border: 'none',
                            color: '#fff',
                            fontWeight: '600',
                            borderRadius: '12px',
                            boxShadow: '0 4px 20px rgba(138, 43, 226, 0.4)',
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        ✏️ Edit Profile
                    </button>
                    {saveMessage && (
                        <p style={{ fontSize: '0.9rem', color: '#4ade80', marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
                            ✓ Profile saved successfully
                        </p>
                    )}
                </div>
            ) : (
                <div style={{
                    marginTop: '32px',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <button
                        onClick={() => setIsEditing(false)}
                        style={{
                            padding: '16px 32px',
                            borderRadius: '12px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#ccc',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#666'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                    >
                        <span>✕</span> Cancel
                    </button>
                    <button
                        onClick={() => {
                            onSave();
                            setIsEditing(false);
                            setSaveMessage(true);
                            setTimeout(() => setSaveMessage(false), 3000);
                        }}
                        style={{
                            padding: '16px 48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(90deg, var(--accent-purple) 0%, #a855f7 100%)',
                            border: 'none',
                            color: '#fff',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(138, 43, 226, 0.4)',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        <span>💾</span> Save Changes
                    </button>
                </div>
            )}
        </div>
    );
};

export default Profile;
