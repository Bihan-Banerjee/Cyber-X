import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { NavLink } from "@/components/navlink";
import { Link } from "react-router-dom";

interface NavItem {
  name: string;
  path: string;
}

interface NavbarMenuProps {
  items: NavItem[];
}

const NavbarMenu = ({ items }: NavbarMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Scroll reactive opacity
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 120], [0.4, 0.9]);

  return (
    <motion.nav
      style={{ backgroundColor: bgOpacity }}
      className="
        fixed top-0 left-0 right-0 z-50 backdrop-blur-md
        border-b border-cyber-red/30 relative
        before:absolute before:bottom-0 before:left-0 before:w-full before:h-[1px]
        before:bg-gradient-to-r before:from-cyber-red before:via-cyber-cyan before:to-cyber-red
        before:opacity-40
      "
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-center justify-between h-16">

          {/* LOGO */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div
              className="w-8 h-8 bg-cyber-red rounded flex items-center justify-center
                         group-hover:shadow-[0_0_20px_rgba(255,0,51,0.8)]
                         transition-all duration-300"
            >
              <span className="text-white font-bold text-xl">X</span>
            </div>

            <span
              className="text-cyber-cyan text-xl font-bold tracking-wider
                         group-hover:text-cyber-red transition-colors"
            >
              CYBERX
            </span>
          </Link>

          {/* DESKTOP MENU */}
          <div className="hidden md:flex items-center space-x-2 relative">

            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative px-4 py-2 text-cyber-cyan rounded
                           tracking-wide transition-all duration-200
                           hover:text-cyber-red hover:bg-cyber-red/5"
                activeClassName="text-cyber-red"
              >
                {({ isActive }) => (
                  <>
                    <span>{item.name}</span>

                    {isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute left-0 right-0 -bottom-1 h-[2px] bg-cyber-red"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}

          </div>

          {/* MOBILE TOGGLE */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-cyber-cyan hover:text-cyber-red transition-colors"
          >
            {isOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden overflow-hidden pb-4 space-y-2"
            >
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2 rounded text-cyber-cyan
                             hover:text-cyber-red hover:bg-cyber-red/10
                             transition-all"
                  activeClassName="text-cyber-red bg-cyber-red/10"
                >
                  {item.name}
                </NavLink>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.nav>
  );
};

export default NavbarMenu;
