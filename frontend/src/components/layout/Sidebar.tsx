import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Settings, FileText, History, Home } from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: <Home className="w-4 h-4" />,
    href: '/',
  },
  {
    label: 'Generate',
    icon: <FileText className="w-4 h-4" />,
    href: '/generate',
  },
  {
    label: 'History',
    icon: <History className="w-4 h-4" />,
    href: '/history',
  },
  {
    label: 'Settings',
    icon: <Settings className="w-4 h-4" />,
    href: '/settings',
  },
];

function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 min-h-screen border-r bg-card">
      <div className="p-6">
        <h1 className="text-xl font-bold">Test Plan Generator</h1>
        <p className="text-xs text-muted-foreground mt-1">AI-Powered Test Plans</p>
      </div>
      
      <nav className="px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            Backend: <span className="text-green-500">●</span> Connected
          </p>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
