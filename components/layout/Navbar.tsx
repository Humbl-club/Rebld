import React, { memo } from 'react';
import { useHaptic } from '../../hooks/useAnimations';

type Page = 'home' | 'goals' | 'buddies' | 'plan' | 'profile';

interface NavbarProps {
    currentPage: Page;
    onNavigate: (page: Page) => void;
}

// ════════════════════════════════════════════════════════════════════
// NOIR ICONOGRAPHY - Minimalist, Geometric, Thin Stroke (1.5px)
// ════════════════════════════════════════════════════════════════════

const IconHome = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "white" : "#525252"} strokeWidth="1.5">
        <path d="M3 9.5L12 3L21 9.5V20.5C21 21.0523 20.5523 21.5 20 21.5H4C3.44772 21.5 3 21.0523 3 20.5V9.5Z" />
        <path d="M9 21.5V12.5H15V21.5" />
    </svg>
);

const IconGoals = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="20" height="20" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
        <path d="M7 17L17 7" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
        <path d="M17 17V7H7" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
    </svg>
);

const IconCircle = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="8" r="4" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
        <path d="M4 20C4 16 8 16 12 16" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
        <path d="M22 20C22 17 18 17 16 17" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
    </svg>
);

const IconAgenda = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="16" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
        <path d="M3 10H21" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
        <path d="M8 2V6" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
        <path d="M16 2V6" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
    </svg>
);

const IconProfile = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
        <circle cx="12" cy="7" r="4" stroke={active ? "white" : "#525252"} strokeWidth="1.5" />
    </svg>
);

// ════════════════════════════════════════════════════════════════════
// THE KEEPER - Floating Glass Pill
// ════════════════════════════════════════════════════════════════════

const NavItem = memo(({
    page,
    currentPage,
    icon,
    onNavigate
}: {
    page: Page,
    currentPage: Page,
    icon: (props: { active: boolean }) => React.ReactNode,
    onNavigate: (p: Page) => void
}) => {
    const isActive = currentPage === page;
    const haptic = useHaptic();

    const handleClick = () => {
        if (!isActive) {
            haptic.light();
            onNavigate(page);
        }
    };

    return (
        <button
            onClick={handleClick}
            className="relative flex items-center justify-center w-12 h-12 transition-all active:scale-90"
        >
            {/* Active Indicator (Glow) */}
            {isActive && (
                <div className="absolute inset-0 bg-white/10 blur-xl rounded-full" />
            )}

            {/* Icon */}
            <div className="relative z-10 transition-transform duration-300">
                {icon({ active: isActive })}
            </div>

            {/* Active Dot (Minimalist) */}
            {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]" />
            )}
        </button>
    );
});

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
    return (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <nav
                className="
                    pointer-events-auto
                    flex items-center gap-2 px-2 py-2
                    bg-black/80 backdrop-blur-2xl
                    border border-white/10
                    rounded-full
                    shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                "
            >
                <NavItem page="home" currentPage={currentPage} onNavigate={onNavigate} icon={IconHome} />
                <NavItem page="goals" currentPage={currentPage} onNavigate={onNavigate} icon={IconGoals} />
                <div className="w-px h-6 bg-white/10 mx-1" /> {/* Divider */}
                <NavItem page="buddies" currentPage={currentPage} onNavigate={onNavigate} icon={IconCircle} />
                <NavItem page="plan" currentPage={currentPage} onNavigate={onNavigate} icon={IconAgenda} />
                <NavItem page="profile" currentPage={currentPage} onNavigate={onNavigate} icon={IconProfile} />
            </nav>
        </div>
    );
}
