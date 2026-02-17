import React, { useEffect } from 'react';

const Landing = ({ onGetStarted, onLogin }) => {
    // Simple mouse move effect for glass cards
    useEffect(() => {
        const handleMouseMove = (e) => {
            document.querySelectorAll('.glass-card').forEach(card => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div>
            {/* Nav */}
            <nav className="nav-header">
                <div style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.03em', color: '#FFF' }}>
                    FitTrack<span style={{ color: 'var(--accent-purple)' }}>.</span>
                </div>
                <div>
                    <button
                        onClick={onLogin}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            padding: '10px 28px',
                            borderRadius: '12px',
                            color: '#FFF',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.target.style.borderColor = '#FFF'; e.target.style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={e => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'; e.target.style.background = 'transparent' }}
                    >
                        Sign In
                    </button>
                </div>
            </nav>

            {/* HERO SECTION - Centered Alignment */}
            <section className="section-wrapper bg-hero" style={{ paddingTop: '220px', paddingBottom: '160px', textAlign: 'center' }}>
                <div className="orbital-glow" style={{ top: '-400px', left: '50%', transform: 'translateX(-50%)', opacity: 0.6 }} />

                <div className="container">
                    {/* Badge */}
                    <div style={{ animation: 'fadeSlideUp 0.8s ease-out forwards', opacity: 0, marginBottom: '40px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '100px', background: 'rgba(138, 43, 226, 0.15)', border: '1px solid rgba(138, 43, 226, 0.3)', fontSize: '0.9rem', color: '#E8DFF5', fontWeight: '500', boxShadow: '0 0 20px rgba(138, 43, 226, 0.1)' }}>
                        <span style={{ display: 'block', width: '6px', height: '6px', background: '#FFF', borderRadius: '50%', boxShadow: '0 0 10px #FFF' }}></span>
                        AI-powered training & nutrition
                    </div>

                    <h1 style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
                        Train smarter.<br />
                        Eat better.<br />
                        <span style={{ color: 'var(--accent-purple)' }}>Progress consistently.</span>
                    </h1>

                    <p style={{ animation: 'fadeSlideUp 0.8s ease-out forwards', animationDelay: '0.2s', opacity: 0, margin: '48px auto 64px', maxWidth: '600px', color: '#B0B0B0', fontSize: '1.25rem' }}>
                        An Artificial Intelligence driven fitness assistant that adapts to your life, goals, and recovery in real time.
                    </p>

                    <div style={{ animation: 'fadeSlideUp 0.8s ease-out forwards', animationDelay: '0.3s', opacity: 0 }}>
                        <button onClick={onGetStarted} className="btn btn-primary">
                            Get Started
                        </button>
                    </div>
                </div>
            </section>

            {/* 4. Subtle Divider */}
            <div className="hairline-divider"></div>

            {/* FEATURES SECTION - Flat Dark Background, Grid Rhythm */}
            <section className="section-wrapper bg-features">
                <div className="container">
                    {/* Landing Moment: Title separate from content */}
                    <div style={{ textAlign: 'center', marginBottom: 'var(--content-gap)' }}>
                        <h2 style={{ animation: 'fadeSlideUp 1s ease-out forwards' }}>
                            Everything your training needs
                        </h2>
                    </div>

                    <div className="features-grid">
                        <Card primary delay="0.1s" icon="🎥" title="Pose & Form" desc="Real-time AI feedback to fix posture and prevent injuries." />
                        <Card primary delay="0.2s" icon="⚡" title="AI Workouts" desc="Training plans that evolve with your performance." />
                        <Card delay="0.3s" icon="🧬" title="Smart Nutrition" desc="Goal-based meal planning that adapts to you." />
                        <Card delay="0.4s" icon="🔄" title="Adaptive Refresh" desc="Instantly regenerate plans when life changes." />
                        <Card delay="0.5s" icon="🎯" title="Goal Planning" desc="Clear targets for muscle, strength, or endurance." />
                        <Card delay="0.6s" icon="📊" title="Analytics" desc="Deep insights into consistency and progress." />
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS - Lighter Background, Vertical Rhythm */}
            <section className="section-wrapper bg-steps">
                <div className="container">
                    {/* Landing Moment */}
                    <div style={{ textAlign: 'center', marginBottom: 'var(--content-gap)' }}>
                        <h2 style={{ animation: 'fadeSlideUp 1s ease-out forwards' }}>
                            How FitTrack Works
                        </h2>
                    </div>

                    {/* Vertical Alignment inside Centered Wrapper */}
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <StepItem
                            delay="0.2s"
                            number="01"
                            title="Tell us about you"
                            desc="Input your goals, available equipment, and dietary preferences. We create a profile unique to your physiology."
                        />
                        <StepItem
                            delay="0.4s"
                            number="02"
                            title="We build your plan"
                            desc="Get a complete weekly schedule tailored to your exact needs, with flexibility built-in for rest days."
                        />
                        <StepItem
                            delay="0.6s"
                            number="03"
                            title="Stay consistent"
                            desc="Follow the plan, track your progress, and let the AI adapt your future workouts based on performance."
                        />
                    </div>
                </div>
            </section>

            {/* STATEMENT SECTION - Flat Dark, Text Only */}
            <section className="section-wrapper bg-features" style={{ textAlign: 'center', padding: '180px 0 120px' }}>
                <div className="container">
                    <h2 style={{ lineHeight: '1.2', fontWeight: '800', maxWidth: '900px', margin: '0 auto' }}>
                        No random plans.<br />
                        No motivation hacks.<br />
                        <span style={{ color: 'var(--accent-purple)' }}>Just consistent progress.</span>
                    </h2>
                </div>
            </section>

            {/* FINAL CTA - Soft Gradient Card */}
            <section className="section-wrapper" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
                <div className="container">


                    <footer style={{ textAlign: 'center', color: 'var(--text-meta)', fontSize: '0.85rem', marginTop: '0' }}>
                        &copy; {new Date().getFullYear()} FitTrack. All rights reserved.
                    </footer>
                </div>
            </section>
        </div>
    );
};

const Card = ({ icon, title, desc, primary, delay }) => (
    <div className={`glass-card ${primary ? 'primary' : ''}`} style={{ padding: '36px', animationDelay: delay }}>
        <div className="feature-icon-box" style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}>{icon}</div>
        <h3 style={{ marginBottom: '12px', color: '#FFF' }}>{title}</h3>
        <p style={{ fontSize: '1rem', color: '#A1A1AA', lineHeight: '1.5' }}>{desc}</p>
    </div>
);

const StepItem = ({ number, title, desc, delay }) => (
    <div className="step-item-vertical" style={{ animationDelay: delay }}>
        <div className="step-number">{number}</div>
        <div>
            <h3 style={{ marginBottom: '12px', fontSize: '2rem', color: '#FFF' }}>{title}</h3>
            <p style={{ fontSize: '1.1rem', color: '#A1A1AA', lineHeight: '1.6' }}>{desc}</p>
        </div>
    </div>
);

export default Landing;
