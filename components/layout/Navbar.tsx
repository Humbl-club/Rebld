import React from 'react';

type Page = 'home' | 'goals' | 'buddies' | 'plan' | 'profile';

interface NavbarProps {
    currentPage: Page;
    onNavigate: (page: Page) => void;
}

// Refined icon components with elegant thin strokes
function DashboardIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
        </svg>
    );
}

function ProgressIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 20h18" />
            <path d="M6 16v-4" />
            <path d="M10 16v-8" />
            <path d="M14 16v-6" />
            <path d="M18 16v-10" />
        </svg>
    );
}

function CommunityIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M6 21v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
            <circle cx="5" cy="9" r="2" />
            <circle cx="19" cy="9" r="2" />
            <path d="M3 21v-.5a2.5 2.5 0 0 1 2.5-2.5" />
            <path d="M21 21v-.5a2.5 2.5 0 0 0-2.5-2.5" />
        </svg>
    );
}

function ScheduleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18" />
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <circle cx="8" cy="14" r="1" fill="currentColor" />
            <circle cx="12" cy="14" r="1" fill="currentColor" />
            <circle cx="16" cy="14" r="1" fill="currentColor" />
        </svg>
    );
}

function AccountIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </svg>
    );
}

interface TabItemProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

function TabItem({ icon, label, isActive, onClick }: TabItemProps) {
    return (
        <button
            onClick={onClick}
            className={`
                flex flex-col items-center justify-center
                min-w-[52px] py-2 px-1.5 rounded-xl
                transition-all duration-200 ease-out
                ${isActive
                    ? 'text-[var(--brand-primary)]'
                    : 'text-[var(--text-tertiary)] active:text-[var(--text-secondary)] active:scale-95'
                }
            `}
            aria-current={isActive ? 'page' : undefined}
        >
            <div className={`w-[22px] h-[22px] mb-0.5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {icon}
            </div>
            <span className={`text-[9px] tracking-wider uppercase font-medium ${isActive ? 'font-semibold text-[var(--brand-primary)]' : ''}`}>
                {label}
            </span>
        </button>
    );
}

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
    const tabs: { id: Page; icon: React.ReactNode; label: string }[] = [
        { id: 'home', icon: <DashboardIcon className="w-full h-full" />, label: 'Home' },
        { id: 'goals', icon: <ProgressIcon className="w-full h-full" />, label: 'Progress' },
        { id: 'buddies', icon: <CommunityIcon className="w-full h-full" />, label: 'Buddies' },
        { id: 'plan', icon: <ScheduleIcon className="w-full h-full" />, label: 'Plan' },
        { id: 'profile', icon: <AccountIcon className="w-full h-full" />, label: 'Profile' },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)]"
            role="navigation"
            aria-label="Main navigation"
        >
            {/* Floating pill navbar */}
            <div
                className="
                    mx-auto mb-2
                    bg-[var(--bg-secondary)]/90 backdrop-blur-xl
                    border border-[var(--border-default)]/50
                    rounded-2xl
                    px-2 py-1.5
                "
                style={{
                    maxWidth: '360px',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset',
                }}
            >
                <div className="flex items-center justify-around">
                    {tabs.map((tab) => (
                        <TabItem
                            key={tab.id}
                            icon={tab.icon}
                            label={tab.label}
                            isActive={currentPage === tab.id}
                            onClick={() => onNavigate(tab.id)}
                        />
                    ))}
                </div>
            </div>
        </nav>
    );
}
