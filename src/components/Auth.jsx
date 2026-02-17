import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const Auth = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(false);
    const [isReset, setIsReset] = useState(false); // New state for Forgot Password
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '', fullName: '' });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    // Check for redirect from signup
    React.useEffect(() => {
        if (sessionStorage.getItem('signupSuccess')) {
            setIsLogin(true);
            setSuccess('Account created successfully! Please log in.');
            sessionStorage.removeItem('signupSuccess');
        }
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setError(null);
        setSuccess(null);
    };

    const handleSignUp = async () => {
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(null);

        try {
            // BLOCK APP.JSX FROM SHOWING ONBOARDING
            sessionStorage.setItem('isSigningUp', 'true');

            // 1. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // 2. Update Display Name
            await updateProfile(user, {
                displayName: formData.fullName
            });

            // 3. Create User Document in Firestore (Profile)
            await setDoc(doc(db, "users", user.uid), {
                fullName: formData.fullName,
                email: formData.email,
                onboardingCompleted: false,
                createdAt: new Date()
            });

            // 4. Set Flag and Sign Out to force Login flow
            sessionStorage.setItem('signupSuccess', 'true');
            await signOut(auth);

            // 5. Handle UI Transition locally (since component might not remount)
            setIsLogin(true);
            setSuccess('Account created successfully! Please log in.');
            sessionStorage.removeItem('signupSuccess');
            sessionStorage.removeItem('isSigningUp');

        } catch (error) {
            console.error("Signup Error:", error);
            sessionStorage.removeItem('isSigningUp'); // UNBLOCK ON ERROR

            if (error.code === 'auth/email-already-in-use') {
                setError('Email already registered. Please log in.');
            } else if (error.code === 'auth/weak-password') {
                setError('Password is too weak.');
            } else {
                setError('Error creating account. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        setLoading(true);
        setError('');
        setSuccess(null);

        try {
            await signInWithEmailAndPassword(auth, formData.email, formData.password);
            // Success handled by App.jsx listener
        } catch (error) {
            console.error("Login Error:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                setError('Invalid email or password.');
            } else {
                setError('Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!formData.email) {
            setError('Please enter your email to reset password.');
            return;
        }
        setLoading(true);
        setError('');
        setSuccess(null);

        try {
            await sendPasswordResetEmail(auth, formData.email);
            setSuccess(`Reset link sent to ${formData.email}. Check your inbox!`);
            setFormData({ ...formData, password: '' }); // Clear password for safety
            setTimeout(() => {
                setIsReset(false); // Go back to login after delay
                setIsLogin(true);
                setError(null);
            }, 3000);
        } catch (error) {
            console.error("Reset Error:", error);
            if (error.code === 'auth/user-not-found') {
                setError('No account found with this email.');
            } else {
                setError('Failed to send reset email. Try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-deep)' }}>
            {/* LEFT PANEL - QUOTE */}
            <div style={{
                flex: 1,
                background: '#0a0a0a',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '80px',
                paddingTop: '140px',
                borderRight: '1px solid rgba(255,255,255,0.03)'
            }} className="auth-left-panel">
                <h2 style={{ fontSize: '2.5rem', lineHeight: '1.2', maxWidth: '500px', marginBottom: '20px', color: '#E0E0E0' }}>
                    Consistency beats intensity. <span style={{ color: 'var(--accent-purple)' }}>Every single time.</span>
                </h2>
                <p style={{ color: 'var(--text-meta)', fontSize: '1.1rem' }}>
                    <span style={{ color: '#FFF' }}>Build habits,</span> <span style={{ color: 'var(--accent-purple)' }}>not burnout.</span>
                </p>
            </div>

            {/* RIGHT PANEL - FORM */}
            <div style={{
                flex: 1,
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px'
            }}>
                <div style={{ width: '100%', maxWidth: '420px' }}>
                    <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                            {isReset ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
                        </h1>
                        <p style={{ color: 'var(--accent-purple)' }}>
                            {isReset ? 'Enter your email to receive a reset link.' : (isLogin ? 'Enter your details to sign in.' : 'Start your journey today.')}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* FULL NAME - Only for Sign Up */}
                        {!isLogin && !isReset && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '10px', color: '#FFF', fontSize: '0.9rem', fontWeight: '500' }}>Full Name</label>
                                <input
                                    name="fullName"
                                    type="text"
                                    placeholder="John Doe"
                                    className="input-field"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                />
                            </div>
                        )}

                        {/* EMAIL - Always Visible */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '10px', color: '#FFF', fontSize: '0.9rem', fontWeight: '500' }}>Email</label>
                            <input
                                name="email"
                                type="email"
                                placeholder="you@example.com"
                                className="input-field"
                                value={formData.email}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* PASSWORD - Hidden for Reset */}
                        {!isReset && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '10px', color: '#FFF', fontSize: '0.9rem', fontWeight: '500' }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="input-field"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                    />
                                    <button
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', color: 'var(--text-meta)', cursor: 'pointer',
                                            padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.6
                                        }}
                                        title={showPassword ? "Hide password" : "Show password"}
                                        onMouseEnter={e => e.target.style.opacity = '1'}
                                        onMouseLeave={e => e.target.style.opacity = '0.6'}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {!isLogin && (
                                    <p style={{ marginTop: '8px', color: 'var(--text-meta)', fontSize: '0.75rem', lineHeight: '1.4' }}>
                                        Must be at least 8 characters.
                                    </p>
                                )}
                                {/* Forgot Password Link */}
                                {isLogin && (
                                    <div style={{ textAlign: 'right', marginTop: '12px' }}>
                                        <span
                                            onClick={() => { setIsReset(true); setError(null); setSuccess(null); }}
                                            style={{
                                                color: 'var(--accent-purple)',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'color 0.2s'
                                            }}
                                            onMouseEnter={e => e.target.style.color = '#fff'}
                                            onMouseLeave={e => e.target.style.color = 'var(--accent-purple)'}
                                        >
                                            Forgot Password?
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {error && <div style={{ color: '#ff4d4f', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
                        {success && <div style={{ color: '#4ade80', fontSize: '0.9rem', textAlign: 'center' }}>{success}</div>}

                        <button
                            onClick={isReset ? handleResetPassword : (isLogin ? handleLogin : handleSignUp)}
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '8px', borderRadius: '12px' }}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : (isReset ? 'Send Reset Link' : (isLogin ? 'Log In' : 'Create Account'))}
                        </button>
                    </div>

                    <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                        {isReset ? (
                            <span
                                onClick={() => { setIsReset(false); setIsLogin(true); setError(null); setSuccess(null); }}
                                style={{
                                    color: 'var(--accent-purple)',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    transition: 'color 0.2s'
                                }}
                                onMouseEnter={e => e.target.style.color = '#fff'}
                                onMouseLeave={e => e.target.style.color = 'var(--accent-purple)'}
                            >
                                Back to Log In
                            </span>
                        ) : (
                            <>
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                                <span
                                    onClick={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); setIsReset(false); }}
                                    style={{
                                        color: 'var(--accent-purple)',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={e => e.target.style.color = '#fff'}
                                    onMouseLeave={e => e.target.style.color = 'var(--accent-purple)'}
                                >
                                    {isLogin ? 'Sign Up' : 'Log In'}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
