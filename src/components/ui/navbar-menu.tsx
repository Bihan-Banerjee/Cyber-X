import { Link } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";

interface NavItem {
  name: string;
  path: string;
}

interface NavbarMenuProps {
  items: NavItem[];
}

const NavbarMenu = ({ items }: NavbarMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-cyber-red/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-cyber-red rounded flex items-center justify-center">
              <span className="text-white font-bold text-xl">X</span>
            </div>
            <span className="text-cyber-cyan text-xl font-bold tracking-wider">CYBERX</span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex space-x-1">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="px-4 py-2 text-cyber-cyan hover:text-cyber-red hover:bg-cyber-red/10 rounded transition-all tracking-wide"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-cyber-cyan hover:text-cyber-red transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-cyber-cyan hover:text-cyber-red hover:bg-cyber-red/10 rounded transition-all tracking-wide"
              >
                {item.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavbarMenu;
