import { Link } from "react-router-dom";
import { Shield, Terminal, Activity, Cpu, Lock, Zap } from "lucide-react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const Home = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Parallax transforms
  const y1 = useTransform(smoothProgress, [0, 1], [0, -200]);
  const y2 = useTransform(smoothProgress, [0, 1], [0, -400]);
  const opacity = useTransform(smoothProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(smoothProgress, [0, 0.5], [1, 0.8]);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Three.js background setup
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.position.z = 5;

    // Create particle system
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 3000;
    const posArray = new Float32Array(particlesCount * 3);
    const colorArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 20;
      posArray[i + 1] = (Math.random() - 0.5) * 20;
      posArray[i + 2] = (Math.random() - 0.5) * 20;

      // Color variation (red/cyan theme)
      if (Math.random() > 0.5) {
        colorArray[i] = 1; // R
        colorArray[i + 1] = 0; // G
        colorArray[i + 2] = 0.3; // B (red-ish)
      } else {
        colorArray[i] = 0; // R
        colorArray[i + 1] = 0.9; // G
        colorArray[i + 2] = 1; // B (cyan)
      }
    }

    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Create geometric shapes
    const geometries = [
      new THREE.TorusGeometry(0.7, 0.2, 16, 100),
      new THREE.OctahedronGeometry(0.8),
      new THREE.IcosahedronGeometry(0.8),
    ];

    const materials = geometries.map(
      () =>
        new THREE.MeshBasicMaterial({
          color: 0xff0033,
          wireframe: true,
          transparent: true,
          opacity: 0.15,
        })
    );

    const meshes = geometries.map((geo, i) => {
      const mesh = new THREE.Mesh(geo, materials[i]);
      mesh.position.set((i - 1) * 3, 0, 0);
      scene.add(mesh);
      return mesh;
    });

    // Animation loop
    let mouseX = 0;
    let mouseY = 0;
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const time = Date.now() * 0.0005;

      // Rotate particles
      particlesMesh.rotation.y = time * 0.2;
      particlesMesh.rotation.x = time * 0.1;

      // Animate meshes
      meshes.forEach((mesh, i) => {
        mesh.rotation.x = time + i;
        mesh.rotation.y = time * 0.5 + i;
        mesh.position.y = Math.sin(time + i) * 0.5;
      });

      // Camera movement based on mouse
      camera.position.x += (mouseX - camera.position.x) * 0.05;
      camera.position.y += (-mouseY - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    // Mouse move handler for 3D scene
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      renderer.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      geometries.forEach((geo) => geo.dispose());
      materials.forEach((mat) => mat.dispose());
    };
  }, []);

  // Floating particles effect
  const FloatingParticle = ({ delay = 0, duration = 20 }) => {
    return (
      <motion.div
        className="absolute w-1 h-1 bg-cyber-cyan rounded-full opacity-40"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
        }}
        animate={{
          y: [0, -100, 0],
          x: [0, Math.random() * 50 - 25, 0],
          opacity: [0, 0.6, 0],
        }}
        transition={{
          duration,
          repeat: Infinity,
          delay,
          ease: "easeInOut",
        }}
      />
    );
  };

  // Glitch text effect
  const GlitchText = ({ children, className = "" }: { children: string; className?: string }) => {
  return (
    <div className={`relative select-none ${className}`}>

      {/* Base text */}
      <motion.h1
        className="relative z-10"
        animate={{
          textShadow: [
            "0 0 25px rgba(255,0,51,0.8)",
            "0 0 45px rgba(255,0,51,0.6)",
            "0 0 25px rgba(255,0,51,0.8)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {children}
      </motion.h1>

      {/* Cyan ghost */}
      <motion.h1
        className="absolute inset-0 z-0 text-cyber-cyan opacity-70"
        animate={{
          x: [-1, 2, -1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
      >
        {children}
      </motion.h1>

      {/* Red ghost */}
      <motion.h1
        className="absolute inset-0 z-0 text-cyber-red opacity-60"
        animate={{
          x: [2, -2, 2],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
      >
        {children}
      </motion.h1>

      {/* Rare glitch jump */}
      <motion.h1
        className="absolute inset-0 z-0 text-white opacity-20"
        animate={{
          opacity: [0, 0, 0.6, 0],
          x: [0, 0, -6, 0],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatDelay: 6,
        }}
      >
        {children}
      </motion.h1>

    </div>
  );
};


  const features = [
    {
      icon: Shield,
      title: "SECURITY TOOLS",
      description: "Port scanning, vulnerability assessment, and penetration testing utilities",
      color: "red",
      delay: 0,
    },
    {
      icon: Terminal,
      title: "THREAT INTEL",
      description: "Real-time threat intelligence, breach monitoring, and OSINT capabilities",
      color: "cyan",
      delay: 0.2,
    },
    {
      icon: Activity,
      title: "HONEYPOTS",
      description: "Deploy and monitor honeypots to track attackers and analyze threats",
      color: "red",
      delay: 0.4,
    },
    {
      icon: Cpu,
      title: "AI DEFENSE",
      description: "Machine learning-powered threat detection and automated response systems",
      color: "cyan",
      delay: 0.6,
    },
    {
      icon: Lock,
      title: "ENCRYPTION",
      description: "Military-grade encryption protocols and secure communication channels",
      color: "red",
      delay: 0.8,
    },
    {
      icon: Zap,
      title: "RAPID RESPONSE",
      description: "Instant incident response and automated threat neutralization capabilities",
      color: "cyan",
      delay: 1,
    },
  ];

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden">
      {/* Three.js Canvas Background */}
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full -z-10"
        style={{ pointerEvents: "none" }}
      />

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none -z-5">
        {[...Array(50)].map((_, i) => (
          <FloatingParticle key={i} delay={i * 0.2} duration={15 + Math.random() * 10} />
        ))}
      </div>

      {/* Animated grid overlay */}
      <motion.div
        className="fixed inset-0 -z-5 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          x: useTransform(smoothProgress, [0, 1], [0, 50]),
        }}
      />

      <div className="w-full max-w-6xl mx-auto px-4 py-12 relative z-10">
        {/* Hero section */}
        <motion.div
          className="text-center mb-32 relative"
          style={{ opacity, scale, y: y1 }}
        >
          {/* Animated corner brackets */}
          <motion.div
            className="absolute -top-8 -left-8 w-24 h-24 border-t-4 border-l-4 border-cyber-red"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
          <motion.div
            className="absolute -top-8 -right-8 w-24 h-24 border-t-4 border-r-4 border-cyber-cyan"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          />
          <motion.div
            className="absolute -bottom-8 -left-8 w-24 h-24 border-b-4 border-l-4 border-cyber-cyan"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          />
          <motion.div
            className="absolute -bottom-8 -right-8 w-24 h-24 border-b-4 border-r-4 border-cyber-red"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          />

          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <GlitchText className="text-6xl md:text-9xl font-bold mb-6 tracking-wider">
              CYBERX
            </GlitchText>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <motion.p
              className="text-xl md:text-3xl text-cyber-cyan mb-12 tracking-[0.3em] font-light"
              animate={{
                opacity: [0.7, 1, 0.7],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              ADVANCED CYBERSECURITY PLATFORM
            </motion.p>

            {/* Animated underline */}
            <motion.div
              className="h-1 bg-gradient-to-r from-transparent via-cyber-red to-transparent mx-auto mb-12"
              initial={{ width: 0 }}
              animate={{ width: "60%" }}
              transition={{ duration: 1.5, delay: 1.2 }}
            />
          </motion.div>

          <motion.div
  className="flex flex-wrap justify-center gap-6"
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8, delay: 1.5 }}
>
  {/* Launch Dashboard */}
  <motion.div
    whileHover={{
      scale: 1.08,
      boxShadow: "0 0 35px rgba(255, 0, 51, 0.7)",
    }}
    whileTap={{ scale: 0.95 }}
  >
    <Link
      to="/dashboard"
      className="px-10 py-5 bg-cyber-red text-white rounded
                 font-bold tracking-wider
                 hover:bg-cyber-deepRed transition-colors -z-1000"
    >
      LAUNCH DASHBOARD
    </Link>
  </motion.div>

  {/* Explore Tools */}
 <motion.div
  whileHover={{
    scale: 1.08,
    boxShadow: "0 0 35px rgba(0, 255, 255, 0.7)",
  }}
  whileTap={{ scale: 0.95 }}
>
  <Link
    to="/tools"
    className="px-10 py-5 border-2 border-cyber-cyan
               text-cyber-cyan rounded
               font-bold tracking-wider
               bg-transparent
               hover:bg-cyber-cyan
               hover:text-black
               transition-all duration-300 z-1000"
  >
    EXPLORE TOOLS
  </Link>
</motion.div>

</motion.div>


          {/* Scanning line effect */}
          <motion.div
            className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-cyan to-transparent "
            animate={{
              y: [0, 300],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </motion.div>

        {/* Stats Section */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-32"
          style={{ y: y2 }}
        >
          {[
            { value: "99.9%", label: "UPTIME" },
            { value: "25+", label: "TOOLS AVAILABLE" },
            { value: "24/7", label: "MONITORING" },
            { value: "<1ms", label: "RESPONSE TIME" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="glass-panel rounded-lg p-6 text-center relative overflow-hidden group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
            >
                      
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-cyber-red/20 to-cyber-cyan/20 opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.3 }}
              />
              <motion.h3
                className="text-4xl md:text-5xl font-bold text-cyber-red mb-2 relative z-10"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.1 + 0.3 }}
                viewport={{ once: true }}
              >
                {stat.value}
              </motion.h3>
              <p className="text-cyber-cyan text-sm tracking-widest relative z-10">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Features grid */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                className="glass-panel rounded-lg p-8 relative overflow-hidden group cursor-pointer"
                initial={{ opacity: 0, y: 50, rotateX: -10 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.4, delay: feature.delay }}
                viewport={{ once: true }}
                whileHover={{
                  scale: 1.04,
                  boxShadow: `0 0 35px ${
                    feature.color === "red"
                      ? "rgba(255, 0, 51, 0.6)"
                      : "rgba(0, 255, 255, 0.6)"
                  }`,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}

                style={{
                  perspective: 1000,
                }}
              >
                {/* Animated border */}
                <motion.div
                  className={`absolute inset-0 border-2 ${
                    feature.color === "red" ? "border-cyber-red" : "border-cyber-cyan"
                  } opacity-0 group-hover:opacity-100 rounded-lg`}
                  animate={{
                    borderRadius: ["0%", "5%", "0%"],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Corner accents */}
                <motion.div
                  className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${
                    feature.color === "red" ? "border-cyber-red" : "border-cyber-cyan"
                  }`}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: feature.delay + 0.3 }}
                  viewport={{ once: true }}
                />
                <motion.div
                  className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 ${
                    feature.color === "red" ? "border-cyber-red" : "border-cyber-cyan"
                  }`}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: feature.delay + 0.3 }}
                  viewport={{ once: true }}
                />

                {/* Icon with 3D effect */}
                <motion.div
                  className="relative z-10 mb-6"
                  initial={{ rotateY: 0 }}
                  whileHover={{ rotateY: 360, scale: 1.15 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    duration: 0.8,
                  }}
                  style={{
                    transformStyle: "preserve-3d",
                    willChange: "transform",
                  }}
                >
                
                  <Icon
                    className={`w-16 h-16 ${
                      feature.color === "red" ? "text-cyber-red" : "text-cyber-cyan"
                    } mx-auto`}
                    style={{
                      filter: `drop-shadow(0 0 20px ${
                        feature.color === "red" ? "#ff0033" : "#00ffff"
                      })`,
                    }}
                  />
                </motion.div>

                <motion.h3
                  className={`text-xl font-bold ${
                    feature.color === "red" ? "text-cyber-red" : "text-cyber-cyan"
                  } mb-4 tracking-wide relative z-10`}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: feature.delay + 0.2 }}
                  viewport={{ once: true }}
                >
                  {feature.title}
                </motion.h3>

                <motion.p
                  className="text-gray-400 text-sm leading-relaxed relative z-10"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ delay: feature.delay + 0.4 }}
                  viewport={{ once: true }}
                >
                  {feature.description}
                </motion.p>

                {/* Hover effect background */}
                <motion.div
                  className={`absolute inset-0 ${
                    feature.color === "red"
                      ? "bg-gradient-to-br from-cyber-red/10 to-transparent"
                      : "bg-gradient-to-br from-cyber-cyan/10 to-transparent"
                  } opacity-0 group-hover:opacity-100`}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Call to action */}
        <motion.div
          className="text-center py-20 relative"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          

          <motion.h2
            className="text-4xl md:text-6xl font-bold text-cyber-cyan mb-6 tracking-wider relative z-10"
            animate={{
              textShadow: [
                "0 0 20px rgba(0, 255, 255, 0.8)",
                "0 0 40px rgba(0, 255, 255, 0.6)",
                "0 0 20px rgba(0, 255, 255, 0.8)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            READY TO SECURE YOUR FUTURE?
          </motion.h2>

          <motion.p
            className="text-xl text-gray-300 mb-10 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            viewport={{ once: true }}
          >
            Join thousands of organizations trusting CYBERX for their security needs
          </motion.p>

          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/dashboard"
              className="inline-block px-12 py-6 bg-gradient-to-r from-cyber-red to-cyber-deepRed text-white rounded-lg font-bold text-xl tracking-wider relative overflow-hidden group"
            >
              <motion.span
                className="absolute inset-0 bg-gradient-to-r from-cyber-cyan to-cyber-red opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.5 }}
              />
              <span className="relative z-10">GET STARTED NOW</span>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Cursor follower */}
      <motion.div
        className="fixed w-8 h-8 border-2 border-cyber-red rounded-full pointer-events-none z-50 mix-blend-difference"
        animate={{
          x: mousePosition.x * window.innerWidth / 2,
          y: mousePosition.y * window.innerHeight / 2,
        }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      />
      <motion.div
        className="fixed w-4 h-4 bg-cyber-cyan rounded-full pointer-events-none z-50 mix-blend-difference"
        animate={{
          x: mousePosition.x * window.innerWidth / 2,
          y: mousePosition.y * window.innerHeight / 2,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
    </div>
  );
};

export default Home;