import React, { useState } from 'react';
import { generateAIWorkout } from '../services/ai';
import { generateWorkout } from '../logic/workoutGenerator';

// Enhanced Card Component
const SelectionCard = ({ label, description, selected, onClick, icon, className }) => (
    <div
        onClick={onClick}
        className={`selection-card ${selected ? 'selected' : ''} ${className || ''}`}
        style={{}}
    >
        {icon && <div style={{ fontSize: '2.2rem', minWidth: '40px' }}>{icon}</div>}
        <div style={{ flex: 1 }}>
            <div style={{
                fontWeight: selected ? '700' : '600', // Semibold title
                color: selected ? '#fff' : '#e0e0e0',
                fontSize: '1.1rem',
                marginBottom: '4px'
            }}>
                {label}
            </div>
            {description && (
                <div style={{ color: selected ? 'rgba(255,255,255,0.9)' : '#888', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    {description}
                </div>
            )}
        </div>
    </div>
);

const StepContainer = ({ title, subtitle, children }) => (
    <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '8px', fontWeight: '800' }}>{title}</h2> {/* Largest + Bold */}
            {subtitle && <p style={{ color: 'var(--text-meta)', fontSize: '1.1rem' }}>{subtitle}</p>} {/* Muted */}
        </div>
        {children}
    </div>
);

const Onboarding = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        goal: '',
        level: '',
        workout_type: '',
        diet_type: '',
        allergies: [],
        time_availability: '',
        weight: '',
        height: '',
        age: '',
        gender: ''
    });

    const [error, setError] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Initializing AI...');

    const updateData = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
        if (error) setError('');
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        const steps = [
            "Syncing neural network...",
            "Analyzing biometrics...",
            "Consulting expert logic...",
            "Finalizing your plan..."
        ];

        try {
            // Start the message cycle in background to keep UI alive
            let msgIndex = 0;
            const msgInterval = setInterval(() => {
                setLoadingMessage(steps[msgIndex % steps.length]);
                msgIndex++;
            }, 800);

            // CALL AI API
            const aiPlan = await generateWorkoutPlan(formData);

            clearInterval(msgInterval);
            onComplete({ plan: aiPlan, preferences: formData }); // Pass BOTH plan and user data

        } catch (err) {
            console.error(err);
            setLoadingMessage("AI Unavailable. Switching to Offline Mode...");

            // AUTOMATIC FALLBACK
            setTimeout(() => {
                const localPlan = generateWorkout(formData);
                onComplete({ plan: localPlan, preferences: formData });
            }, 1000);
        }
    };

    const validateStep = () => {
        switch (step) {
            case 1: return formData.goal ? true : "Please select a goal.";
            case 2: return formData.level ? true : "Please select a fitness level.";
            case 3: return formData.workout_type ? true : "Please select a training environment.";
            case 4: return formData.equipment && formData.equipment.length > 0 ? true : "Please select at least one equipment option.";
            case 5: return formData.diet_type ? true : "Please select a diet preference.";
            case 6: return formData.allergies && formData.allergies.length > 0 ? true : "Please select allergies (or None).";
            case 7: return formData.time_availability ? true : "Please select your time availability.";
            case 8: return (formData.weight && formData.height && formData.age && formData.gender) ? true : "Please complete all fields correctly.";
            default: return true;
        }
    };

    const nextStep = () => {
        const validation = validateStep();
        if (validation === true) {
            setStep(prev => Math.min(prev + 1, 9));
        } else {
            setError(validation);
        }
    };
    const prevStep = () => {
        setError('');
        setStep(prev => Math.max(prev - 1, 1));
    };


    // Options


    const GoalOptions = [
        { label: "Muscle Gain", desc: "Build lean mass with progressive overload", icon: "💪" },
        { label: "Weight Loss", desc: "Reduce fat while preserving muscle", icon: "⚖️" },
        { label: "General Fitness", desc: "Stay active and improve overall health", icon: "🏃" },
        { label: "Strength & Conditioning", desc: "Enhance functional power and performance", icon: "🏋️" }
    ];
    const LevelOptions = [
        { label: "Beginner", desc: "New to training. Focus on form & habits.", icon: "🌱" },
        { label: "Intermediate", desc: "Consistent for 6+ months. Ready for intensity.", icon: "⚡" },
        { label: "Advanced", desc: "Training for years. Performance focused.", icon: "🔥" }
    ];
    const TimeOptions = [
        { label: "20 min", desc: "High intensity, short duration.", icon: "⚡" },
        { label: "30 min", desc: "Balanced effective workout.", icon: "⏱️" },
        { label: "45 min", desc: "Standard comprehensive session.", icon: "🕐" },
        { label: "60 min", desc: "Volume & endurance focus.", icon: "🏆" }
    ];

    const LocationOptions = [
        { label: "Home", value: "Home", desc: "Convenient & private. Minimal or no equipment.", icon: "🏠" },
        { label: "Gym", value: "Gym", desc: "Full equipment access. Atmosphere & variety.", icon: "🏢" }
    ];
    const EquipmentOptions = [
        { label: "Bodyweight only", desc: "No equipment, just you.", icon: "🧘" },
        { label: "Dumbbells", desc: "Versatile free weights.", icon: "💪" },
        { label: "Resistance bands", desc: "Portable tension training.", icon: "🎗️" },
        { label: "Barbell", desc: "Heavy compound lifting.", icon: "🏋️‍♂️" },
        { label: "Machines", desc: "Guided isolation movements.", icon: "🏗️" }
    ];
    const DietOptions = [
        { label: "Vegetarian", desc: "Plant-based + Dairy/Eggs.", icon: "🥗" },
        { label: "Non-Vegetarian", desc: "Meat, fish & animal products.", icon: "🍗" },
        { label: "Vegan", desc: "Strictly plant-based.", icon: "🌱" },
        { label: "Eggetarian", desc: "Vegetarian + Eggs.", icon: "🥚" }
    ];

    const AllergyOptions = [
        { label: "Nuts", icon: "🥜" },
        { label: "Dairy", icon: "🥛" },
        { label: "Gluten", icon: "🌾" },
        { label: "Soy", icon: "🫘" },
        { label: "None", icon: "🛡️" }
    ];

    return (
        <div style={{ minHeight: '100vh', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Intelligent Progress Bar */}
            <div style={{ width: '100%', maxWidth: '600px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#666', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    <span>Step {step} of 9 · {
                        step === 1 ? 'Goals' :
                            step === 2 ? 'Experience' :
                                step === 3 ? 'Environment' :
                                    step === 4 ? 'Equipment' :
                                        step === 5 ? 'Nutrition' :
                                            step === 6 ? 'Restrictions' :
                                                step === 7 ? 'Availability' :
                                                    step === 8 ? 'Biometrics' : 'Review'
                    }</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: '#333', borderRadius: '2px' }}>
                    <div
                        style={{
                            width: `${(step / 9) * 100}% `,
                            height: '100%',
                            background: '#A78BFA', // Brighter purple
                            borderRadius: '2px',
                            transition: 'width 0.4s ease',
                            boxShadow: '0 0 15px rgba(167, 139, 250, 0.6)'
                        }}
                    ></div>
                </div>
            </div>

            {step === 1 && (
                <StepContainer
                    title="What’s your primary goal?"
                    subtitle="This helps us personalize your training, nutrition, and recovery."
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
                        {GoalOptions.map(opt => {
                            const isSelected = formData.goal === opt.label;
                            // Dim others only if one is selected
                            const isDimmed = formData.goal && !isSelected;

                            return (
                                <SelectionCard
                                    key={opt.label}
                                    label={opt.label}
                                    description={opt.desc}
                                    selected={isSelected}
                                    onClick={() => updateData('goal', opt.label)}
                                    icon={opt.icon}
                                    className={isDimmed ? 'dimmed' : ''}
                                />
                            );
                        })}
                    </div>

                    <div style={{ marginTop: '32px', textAlign: 'center' }}>
                        <p style={{ color: '#444', fontSize: '0.85rem', marginBottom: '20px' }}>
                            You can change this anytime. FitTrack adapts as you evolve.
                        </p>
                        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ {error}</div>}
                        <button
                            onClick={nextStep}
                            className={`btn ${formData.goal ? 'btn-primary' : 'btn-primary'} `}
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                        >
                            Continue <span className="btn-arrow">→</span>
                        </button>
                    </div>
                </StepContainer>
            )}

            {step === 2 && (
                <StepContainer
                    title="What’s your fitness level?"
                    subtitle="We align the intensity to match your current experience."
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                        {LevelOptions.map(opt => {
                            const isSelected = formData.level === opt.label;
                            const isDimmed = formData.level && !isSelected;

                            return (
                                <SelectionCard
                                    key={opt.label}
                                    label={opt.label}
                                    description={opt.desc}
                                    selected={isSelected}
                                    icon={opt.icon}
                                    onClick={() => updateData('level', opt.label)}
                                    className={isDimmed ? 'dimmed' : ''}
                                />
                            );
                        })}
                    </div>

                    <div style={{ marginTop: '32px', textAlign: 'center' }}>
                        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ {error}</div>}
                        <button
                            onClick={nextStep}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                        >
                            Continue <span className="btn-arrow">→</span>
                        </button>
                        <button
                            onClick={prevStep}
                            style={{ background: 'transparent', color: '#666', marginTop: '20px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            ← Back
                        </button>
                    </div>
                </StepContainer>
            )}

            {step === 3 && (
                <StepContainer
                    title="Where do you train?"
                    subtitle="Customizing based on your available environment."
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                        {LocationOptions.map(opt => {
                            const isSelected = formData.workout_type === opt.value;
                            const isDimmed = formData.workout_type && !isSelected;

                            return (
                                <SelectionCard
                                    key={opt.label}
                                    label={opt.label}
                                    description={opt.desc}
                                    selected={isSelected}
                                    icon={opt.icon}
                                    onClick={() => updateData('workout_type', opt.value)}
                                    className={isDimmed ? 'dimmed' : ''}
                                />
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '32px', textAlign: 'center' }}>
                        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ {error}</div>}
                        <button
                            onClick={nextStep}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                        >
                            Continue <span className="btn-arrow">→</span>
                        </button>
                        <button
                            onClick={prevStep}
                            style={{ background: 'transparent', color: '#666', marginTop: '20px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            ← Back
                        </button>
                    </div>
                </StepContainer>
            )}

            {step === 4 && (
                <StepContainer title="Available Equipment?" subtitle="Select all that apply.">
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px', marginBottom: '32px' }}>
                        {EquipmentOptions.map(opt => {
                            const isActive = formData.equipment && formData.equipment.includes(opt.label);
                            // For multi-select: dim only if at least one item is selected AND this one isn't.
                            const hasSelection = formData.equipment && formData.equipment.length > 0;
                            const isDimmed = hasSelection && !isActive;

                            return (
                                <SelectionCard
                                    key={opt.label}
                                    label={opt.label}
                                    description={opt.desc}
                                    selected={isActive}
                                    icon={opt.icon}
                                    onClick={() => {
                                        const current = formData.equipment || [];
                                        const newEq = isActive
                                            ? current.filter(e => e !== opt.label)
                                            : [...current, opt.label];
                                        updateData('equipment', newEq);
                                    }}
                                    className={isDimmed ? 'dimmed' : ''}
                                />
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '32px', textAlign: 'center' }}>
                        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ {error}</div>}
                        <button
                            onClick={nextStep}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                        >
                            Continue <span className="btn-arrow">→</span>
                        </button>
                        <button
                            onClick={prevStep}
                            style={{ background: 'transparent', color: '#666', marginTop: '20px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            ← Back
                        </button>
                    </div>
                </StepContainer>
            )}

            {step === 5 && (
                <StepContainer title="Diet Preference" subtitle="For your personalized meal plan.">
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
                        {DietOptions.map(opt => {
                            const isSelected = formData.diet_type === opt.label;
                            const isDimmed = formData.diet_type && !isSelected;

                            return (
                                <SelectionCard
                                    key={opt.label}
                                    label={opt.label}
                                    description={opt.desc}
                                    selected={isSelected}
                                    icon={opt.icon}
                                    onClick={() => updateData('diet_type', opt.label)}
                                    className={isDimmed ? 'dimmed' : ''}
                                />
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '32px', textAlign: 'center' }}>
                        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ {error}</div>}
                        <button
                            onClick={nextStep}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                        >
                            Continue <span className="btn-arrow">→</span>
                        </button>
                        <button
                            onClick={prevStep}
                            style={{ background: 'transparent', color: '#666', marginTop: '20px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            ← Back
                        </button>
                    </div>
                </StepContainer>
            )}

            {step === 6 && (
                <StepContainer title="Allergies & Restrictions" subtitle="Select any that apply.">
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px', marginBottom: '32px' }}>
                        {AllergyOptions.map(opt => {
                            const isActive = formData.allergies.includes(opt.label);
                            const hasSelection = formData.allergies.length > 0;
                            const isDimmed = hasSelection && !isActive;

                            return (
                                <SelectionCard
                                    key={opt.label} label={opt.label} selected={isActive}
                                    icon={opt.icon}
                                    onClick={() => {
                                        if (opt.label === 'None') {
                                            updateData('allergies', ['None']);
                                        } else {
                                            const newAllergies = isActive
                                                ? formData.allergies.filter(a => a !== 'None' && a !== opt.label)
                                                : [...formData.allergies.filter(a => a !== 'None'), opt.label];
                                            updateData('allergies', newAllergies);
                                        }
                                    }}
                                    className={isDimmed ? 'dimmed' : ''}
                                />
                            );
                        })}
                    </div>
                    <div style={{ marginBottom: '32px' }}>
                        <input
                            type="text"
                            placeholder="Other (type and press enter)"
                            className="input-field"
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (e.target.value && !formData.allergies.includes(e.target.value)) {
                                        updateData('allergies', [...formData.allergies.filter(a => a !== 'None'), e.target.value]);
                                        e.target.value = '';
                                    }
                                }
                            }}
                        />
                        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {formData.allergies.filter(a => !["Nuts", "Dairy", "Gluten", "Soy", "None"].includes(a)).map(a => (
                                <span key={a} style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#A78BFA', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                                    {a} ✕
                                </span>
                            ))}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ {error}</div>}
                        <button
                            onClick={nextStep}
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                        >
                            Continue <span className="btn-arrow">→</span>
                        </button>
                        <button
                            onClick={prevStep}
                            style={{ background: 'transparent', color: '#666', marginTop: '20px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            ← Back
                        </button>
                    </div>
                </StepContainer>
            )}

            {step === 7 && (
                <StepContainer title="Time per session?" subtitle="We'll adjust volume accordingly.">
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
                        {TimeOptions.map(opt => {
                            const isSelected = formData.time_availability === opt.label;
                            const isDimmed = formData.time_availability && !isSelected;

                            return (
                                <SelectionCard
                                    key={opt.label}
                                    label={opt.label}
                                    description={opt.desc}
                                    selected={isSelected}
                                    icon={opt.icon}
                                    onClick={() => updateData('time_availability', opt.label)}
                                    className={isDimmed ? 'dimmed' : ''}
                                />
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '32px', textAlign: 'center' }}>
                        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ {error}</div>}
                        <button
                            onClick={nextStep}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                        >
                            Continue <span className="btn-arrow">→</span>
                        </button>
                        <button
                            onClick={prevStep}
                            style={{ background: 'transparent', color: '#666', marginTop: '20px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            ← Back
                        </button>
                    </div>
                </StepContainer>
            )}

            {step === 8 && (
                <StepContainer title="About You" subtitle="To calculate your exact needs.">
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px', marginBottom: '32px' }}>
                        {/* Gender Selection */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            {['Male', 'Female'].map(g => (
                                <SelectionCard
                                    key={g} label={g} selected={formData.gender === g}
                                    icon={g === 'Male' ? '👨' : '👩'}
                                    onClick={() => updateData('gender', g)}
                                />
                            ))}
                        </div>
                        {/* Inputs Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '0.9rem' }}>Age</label>
                                <input
                                    type="number" placeholder="25"
                                    value={formData.age} onChange={(e) => updateData('age', e.target.value)}
                                    className="input-field" style={{ width: '100%', textAlign: 'center' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '0.9rem' }}>Height (cm)</label>
                                <input
                                    type="number" placeholder="175"
                                    value={formData.height} onChange={(e) => updateData('height', e.target.value)}
                                    className="input-field" style={{ width: '100%', textAlign: 'center' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '0.9rem' }}>Weight (kg)</label>
                                <input
                                    type="number" placeholder="70"
                                    value={formData.weight} onChange={(e) => updateData('weight', e.target.value)}
                                    className="input-field" style={{ width: '100%', textAlign: 'center' }}
                                />
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ {error}</div>}
                        <button
                            onClick={nextStep}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                        >
                            Continue <span className="btn-arrow">→</span>
                        </button>
                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <button
                                onClick={prevStep}
                                style={{ background: 'transparent', color: '#666', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                            >
                                ← Back
                            </button>
                        </div>
                    </div>
                </StepContainer>
            )}

            {step === 9 && (
                <StepContainer title="Review your profile" subtitle="Ready to generate your plan?">
                    <div className="glass-card" style={{ padding: '32px', marginBottom: '32px', textAlign: 'left' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', color: '#ccc' }}>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                                <span style={{ display: 'block', color: '#888', fontSize: '0.85rem' }}>Goal</span>
                                <span style={{ fontWeight: '600', color: '#fff' }}>{formData.goal}</span>
                            </div>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                                <span style={{ display: 'block', color: '#888', fontSize: '0.85rem' }}>Level</span>
                                <span style={{ fontWeight: '600', color: '#fff' }}>{formData.level}</span>
                            </div>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                                <span style={{ display: 'block', color: '#888', fontSize: '0.85rem' }}>Environment</span>
                                <span style={{ fontWeight: '600', color: '#fff' }}>{formData.workout_type}</span>
                            </div>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                                <span style={{ display: 'block', color: '#888', fontSize: '0.85rem' }}>Biometrics</span>
                                <span style={{ fontWeight: '600', color: '#fff' }}>{formData.gender}, {formData.age}yo</span>
                            </div>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                                <span style={{ display: 'block', color: '#888', fontSize: '0.85rem' }}>Stats</span>
                                <span style={{ fontWeight: '600', color: '#fff' }}>{formData.height}cm / {formData.weight}kg</span>
                            </div>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                                <span style={{ display: 'block', color: '#888', fontSize: '0.85rem' }}>Diet</span>
                                <span style={{ fontWeight: '600', color: '#fff' }}>{formData.diet_type}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '1.2rem', padding: '16px', opacity: isGenerating ? 0.9 : 1 }}
                    >
                        {isGenerating ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <span className="spinner"></span> {loadingMessage}
                            </span>
                        ) : (
                            <>Generate My Plan <span className="btn-arrow">🚀</span></>
                        )}
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button
                            onClick={prevStep}
                            disabled={isGenerating}
                            style={{
                                background: 'transparent',
                                color: isGenerating ? '#444' : '#666',
                                border: 'none',
                                cursor: isGenerating ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            ← Back
                        </button>
                    </div>
                </StepContainer>
            )}
        </div>
    );
};

export default Onboarding;
