import { motion, useReducedMotion } from 'framer-motion'

type Props = {
  className?: string
}

/**
 * Ilustrasi hero bencana (gempa, banjir, petir) - vektor + Framer Motion.
 *
 * Sumber aset: di GitHub umumnya hanya *player* (mis. [lottie-web](https://github.com/airbnb/lottie-web)),
 * bukan galeri animasi bencana. File Lottie (JSON) biasanya diunduh dari
 * [LottieFiles (mis. pencarian “earthquake” / “disaster”)](https://lottiefiles.com/free-animations/earthquake),
 * lalu self-host. Jika ingin ganti ke Lottie: `npm i lottie-react`, simpan JSON di
 * `public/lotties/hero-bencana.json`, dan ganti isi komponen ini memakai `lottie-react` + `animationData`.
 */
export function DisasterHeroIllustration({ className = '' }: Props) {
  const reduce = useReducedMotion()

  const shake = reduce
    ? undefined
    : { x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' as const } }
  const waveY = reduce ? undefined : { y: [0, -2, 0], transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' as const } }
  const pulseRing = reduce
    ? undefined
    : {
        scale: [0.85, 1, 0.85],
        opacity: [0.2, 0.45, 0.2],
        transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const },
      }

  return (
    <div
      className={`relative w-full max-w-md ${className}`}
      role="img"
      aria-label="Ilustrasi kesiapsiagaan: gempa, banjir, dan peringatan dini"
    >
      <svg
        viewBox="0 0 400 300"
        className="h-auto max-h-72 w-full text-slate-800 drop-shadow-sm dark:text-slate-200"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="dhh-sky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#ecfeff" />
          </linearGradient>
          <linearGradient id="dhh-hill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.28" />
          </linearGradient>
          <filter id="dhh-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="400" height="200" fill="url(#dhh-sky)" rx="8" />
        <path
          d="M0 200 Q100 150 200 180 T400 165 V300 H0Z"
          fill="url(#dhh-hill)"
          className="opacity-90 dark:opacity-70"
        />
        <motion.path
          d="M40 198 Q200 205 360 198"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          className="text-health-500/70 dark:text-cyan-500/50"
          animate={waveY}
        />
        <motion.ellipse
          cx="200"
          cy="215"
          rx="42"
          ry="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          className="text-amber-500/50"
          animate={pulseRing}
        />
        <motion.g animate={shake}>
          <rect
            x="150"
            y="125"
            width="100"
            height="70"
            rx="4"
            className="fill-white stroke-slate-300 dark:fill-cosmic-800 dark:stroke-cosmic-600"
            strokeWidth="1.5"
          />
          <rect x="165" y="140" width="18" height="22" rx="1" className="fill-cyan-200/80 dark:fill-cyan-900/60" />
          <rect x="217" y="140" width="18" height="22" rx="1" className="fill-cyan-200/80 dark:fill-cyan-900/60" />
          <rect x="185" y="175" width="30" height="20" rx="1" fill="#c41e3a" />
        </motion.g>
        <path
          d="M120 200 L128 220 L160 200 L200 220 L220 200 L255 220 L280 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-amber-600/50 dark:text-amber-400/40"
          strokeLinecap="round"
        />
        <path
          d="M40 200 L200 200"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          className="text-slate-400/60"
        />
        <motion.g
          animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M300 50 L310 80 L300 70 L290 80Z"
            className="fill-amber-400 dark:fill-amber-300"
            filter="url(#dhh-glow)"
          />
        </motion.g>
        <text x="200" y="28" textAnchor="middle" className="fill-slate-600 text-[10px] font-semibold dark:fill-slate-300">
          SiAP-PKM
        </text>
        <g className="fill-slate-500 text-[8px] font-medium dark:fill-slate-400">
          <text x="48" y="190">
            Banjir
          </text>
          <text x="175" y="108">
            Gempa
          </text>
          <text x="312" y="60">
            Cuaca
          </text>
        </g>
      </svg>
    </div>
  )
}
