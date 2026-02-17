import React, { useState } from 'react';

const ChartSection = ({ dailyData, maxDuration, maxDayDuration, avgDuration, bestDayName, hasData }) => {
    const [hoveredDay, setHoveredDay] = useState(null);

    return (
        <div className="premium-card" style={{
            padding: '24px',
            marginBottom: '40px',
            background: '#1A1A1C',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            position: 'relative',
            zIndex: 1 // Context for tooltips
        }}>
            {/* Header with Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>Daily Training Activity</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Your last 7 days of movement</p>
                </div>
                {hasData && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>
                            <span style={{ color: '#666' }}>Avg / Day:</span> <span style={{ color: '#ccc', fontWeight: '400' }}>{avgDuration.toFixed(1)} min</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#888' }}>
                            <span style={{ color: '#666' }}>Best Day:</span> <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>{bestDayName} ({maxDayDuration} min)</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Chart Container - Centered & Constrained to 70% */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                height: '140px',
                gap: '12px',
                paddingTop: '30px',
                width: '70%',
                maxWidth: '600px',
                margin: '0 auto'
            }}>
                {dailyData.map((day, i) => {
                    // Min 15% height for visibility
                    const heightPerc = maxDuration > 0 ? (day.duration / maxDuration) * 100 : 0;
                    const visualHeight = day.hasData ? Math.max(heightPerc, 15) : 0;

                    const isBest = day.hasData && day.duration === maxDayDuration;
                    const isHovered = hoveredDay === i;
                    const otherIsHovered = hoveredDay !== null && hoveredDay !== i;

                    // STRICT COLOR LOGIC
                    // Best Day = Bright Purple Gradient
                    // Normal Workout = Dark Gray/Purple Muted (#3F3F46 with hint of purple)
                    const barBackground = isBest
                        ? 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)'
                        : '#3F3F46'; // Much darker/muted for confusion-free contrast

                    return (
                        <div key={i}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', position: 'relative' }}
                            onMouseEnter={() => setHoveredDay(i)}
                            onMouseLeave={() => setHoveredDay(null)}
                            onFocus={() => setHoveredDay(i)}
                            onBlur={() => setHoveredDay(null)}
                        >
                            {/* BEST LABEL */}
                            {isBest && !isHovered && (
                                <div style={{
                                    position: 'absolute',
                                    top: `${100 - visualHeight}%`,
                                    marginTop: '-24px',
                                    background: '#8b5cf6',
                                    color: '#fff',
                                    fontSize: '0.6rem',
                                    fontWeight: 'bold',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    letterSpacing: '0.5px',
                                    boxShadow: '0 2px 10px rgba(139, 92, 246, 0.5)',
                                    zIndex: 2
                                }}>
                                    BEST
                                </div>
                            )}

                            {/* TOOLTIP */}
                            {isHovered && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: i >= 4 ? 'auto' : '100%',
                                    right: i >= 4 ? '100%' : 'auto',
                                    marginLeft: i >= 4 ? '0' : '12px', // Space to right
                                    marginRight: i >= 4 ? '12px' : '0', // Space to left
                                    transform: 'translateY(-50%)',
                                    background: '#18181B',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    zIndex: 100,
                                    width: 'max-content',
                                    minWidth: '130px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                                    pointerEvents: 'none',
                                    animation: 'fadeIn 0.15s ease-out',
                                    textAlign: 'center'
                                }}>

                                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{day.fullName}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                        {day.hasData ? (
                                            day.titles ? (
                                                day.titles.split(', ').map((title, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isBest ? '#8b5cf6' : '#9CA3AF', flexShrink: 0 }}></div>
                                                        <span>{title}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isBest ? '#8b5cf6' : '#9CA3AF' }}></div>
                                                    <span>Workout Done</span>
                                                </>
                                            )
                                        ) : 'Rest Day'}
                                    </div>
                                    {day.hasData && (
                                        <div style={{ fontSize: '1.25rem', color: isBest ? '#8b5cf6' : '#E5E7EB', fontWeight: 'bold', marginTop: '2px' }}>{day.duration} min</div>
                                    )}
                                </div>
                            )}

                            {/* BAR */}
                            <div
                                className="bar-container"
                                tabIndex={0}
                                style={{
                                    width: '100%',
                                    maxWidth: '36px',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                            >
                                <div style={{
                                    width: '100%',
                                    height: day.hasData ? `${visualHeight}%` : '2px',
                                    background: day.hasData ? barBackground : 'rgba(255,255,255,0.05)',
                                    borderRadius: '6px',
                                    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                    boxShadow: isBest ? '0 0 25px rgba(139, 92, 246, 0.25)' : 'none',
                                    opacity: otherIsHovered ? 0.3 : 1,
                                    transform: isHovered && day.hasData ? 'scaleY(1.08)' : 'scaleY(1)',
                                    filter: isHovered && day.hasData ? 'brightness(1.2)' : 'none',
                                    transformOrigin: 'bottom'
                                }}>
                                </div>
                            </div>

                            <span style={{
                                fontSize: '0.75rem',
                                color: day.hasData ? '#E5E7EB' : '#52525B',
                                fontWeight: day.isToday || day.hasData ? '600' : '400',
                                opacity: otherIsHovered ? 0.3 : 1,
                                transition: 'opacity 0.2s',
                                marginTop: '8px'
                            }}>{day.name}</span>
                        </div>
                    );
                })}
            </div>

            {/* Legend - Updated Colors */}
            {hasData && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '32px', fontSize: '0.75rem', color: '#666', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', width: '70%', margin: '24px auto 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', background: '#3F3F46', borderRadius: '2px' }}></div>
                        <span>Workout</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', background: '#8b5cf6', borderRadius: '2px', boxShadow: '0 0 8px rgba(139, 92, 246, 0.5)' }}></div>
                        <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>Best Day</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartSection;
