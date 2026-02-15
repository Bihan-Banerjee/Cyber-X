import { ReactNode } from "react";
import WebGLBackground from "../WebGLBackground";
import CyberpunkCursor from "../CyberpunkCursor";
import NavbarMenu from "../ui/navbar-menu";
import { navigationItems } from "@/data/navigation";
import Footer from "@/components/ui/footer";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="relative min-h-screen">
      {/* WebGL Background */}
      <WebGLBackground />

      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40 z-[1] pointer-events-none" />

      {/* Scanlines */}
      <div className="scanlines" />

      {/* Custom cursor */}
      <CyberpunkCursor />

      {/* Navbar */}
      <NavbarMenu items={navigationItems} />

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen items-center justify-center p-4 pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
