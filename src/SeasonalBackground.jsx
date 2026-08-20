// Fixed, full-viewport, non-interactive backdrop behind all app content.
// Season is derived from the calendar (northern hemisphere) unless overridden
// via ?season=... in dev, so all four are checkable without waiting months.

const SEASON_THEMES = {
  winter: { gradient: "linear-gradient(180deg, #DCE6EE 0%, #EFE9D8 55%)", motif: "snow", count: 26 },
  spring: { gradient: "linear-gradient(180deg, #F3E6EA 0%, #EFE9D8 55%)", motif: "blossom", count: 18 },
  summer: { gradient: "linear-gradient(180deg, #FBEFC9 0%, #EFE9D8 60%)", motif: "sun", count: 14 },
  // Fall runs the real dark theme (see index.html [data-theme="dark-fall"]) —
  // a dusk-toned gradient so the bright leaves glow against it instead of
  // sitting on a mismatched light sky.
  fall: { gradient: "linear-gradient(180deg, #241C15 0%, #140F0B 65%)", motif: "leaf", count: 16 },
};

const COVER_LOGO = "/cover.png";

export function getSeason(date = new Date()) {
  const month = date.getMonth(); // 0-11
  if (month === 11 || month <= 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  // Summer's window is folded into fall for now, at Damon's request — keep
  // the dark fall theme running straight through until winter hits in Dec.
  return "fall";
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Shared fall palette — vivid enough to glow against the dark-fall theme's
// dusk-toned background, used by both the falling leaves and the tree canopy.
const LEAF_COLORS = ["#FF8C42", "#E85D25", "#F2B134", "#C1440E", "#F4A93B", "#D9702E"];

function Snowflake({ i }) {
  const left = seededRandom(i * 7.1) * 100;
  const size = 3 + seededRandom(i * 3.3) * 5;
  const duration = 14 + seededRandom(i * 5.5) * 12;
  const delay = -seededRandom(i * 9.9) * duration;
  const drift = 20 + seededRandom(i * 2.2) * 40;
  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: -20,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.85)",
        boxShadow: "0 0 4px rgba(255,255,255,0.6)",
        animation: `season-fall ${duration}s linear ${delay}s infinite`,
        "--drift": `${drift}px`,
      }}
    />
  );
}

function Blossom({ i }) {
  const left = seededRandom(i * 6.3) * 100;
  const size = 6 + seededRandom(i * 4.1) * 6;
  const duration = 16 + seededRandom(i * 6.6) * 14;
  const delay = -seededRandom(i * 8.8) * duration;
  const drift = 30 + seededRandom(i * 3.7) * 50;
  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: -20,
        width: size,
        height: size * 0.7,
        borderRadius: "60% 40% 60% 40%",
        background: "rgba(230,168,190,0.75)",
        animation: `season-fall ${duration}s ease-in-out ${delay}s infinite`,
        "--drift": `${drift}px`,
      }}
    />
  );
}

// depth: "near" (bigger, sharper, faster) or "far" (smaller, hazier, slower)
// — two depth bands read as parallax without any real 3D engine.
function Leaf({ i, depth = "near" }) {
  const far = depth === "far";
  const left = seededRandom(i * 5.9 + (far ? 100 : 0)) * 100;
  const size = (far ? 5 : 9) + seededRandom(i * 4.4) * (far ? 5 : 9);
  const duration = (far ? 20 : 12) + seededRandom(i * 7.7) * 12;
  const delay = -seededRandom(i * 9.1) * duration;
  const drift = 25 + seededRandom(i * 2.8) * 55;
  const hue = LEAF_COLORS[i % LEAF_COLORS.length];
  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: -20,
        width: size,
        height: size,
        borderRadius: "0% 60% 0% 60%",
        background: hue,
        opacity: far ? 0.35 : 0.8,
        filter: far ? "blur(1px)" : "none",
        animation: `season-fall ${duration}s ease-in ${delay}s infinite, season-spin ${duration / 2}s linear ${delay}s infinite`,
        "--drift": `${drift}px`,
      }}
    />
  );
}

function SunRay({ i }) {
  const left = 10 + seededRandom(i * 6.1) * 80;
  const size = 3 + seededRandom(i * 3.9) * 4;
  const duration = 6 + seededRandom(i * 5.2) * 6;
  const delay = -seededRandom(i * 8.4) * duration;
  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        bottom: -10,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(199,154,61,0.55)",
        animation: `season-rise ${duration}s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

// A little vignette in the corner: a branch, a rope, a tire, and the cover
// photo riding inside it, all swaying together as one rigid group pivoting
// from the branch — plus a couple of kids hopping in a leaf pile below.
// One coordinate system for everything (SVG viewBox === container pixel
// size), so the HTML swing/leaf-pile layers can hang off exact points on
// the tree without any percentage-guessing between the two.
const TREE_W = 360;
const TREE_H = 860;

// A visible branch network (trunk forking into primary branches, primary
// branches forking into thinner twigs) — modeled on a real deciduous tree's
// silhouette rather than a single stub, so structure reads through the gaps
// between leaf clusters the way it does in a real autumn tree illustration.
const BRANCHES = [
  { d: "M172,400 C 110,378 55,335 22,278", w: 16 }, // the swing hangs from this one
  { d: "M176,340 C 220,322 255,295 275,255", w: 13 },
  { d: "M168,320 C 140,280 100,240 70,200", w: 11 },
  { d: "M176,300 C 210,260 245,220 270,185", w: 10 },
  { d: "M172,310 C 170,260 168,210 165,160", w: 9 },
  { d: "M100,255 C 85,238 78,222 72,205", w: 5 }, // twig off the upper-left branch
  { d: "M245,215 C 258,202 264,188 268,172", w: 5 }, // twig off the upper-right branch
  { d: "M150,270 C 128,255 112,245 98,238", w: 5 },
];

const CANOPY_CENTER = { x: 172, y: 195 };
const CANOPY_RX = 200;
const CANOPY_RY = 155;
const CANOPY_LEAF_COUNT = 260;
const LEAF_SHAPE_D = "M0,-7 C3.5,-7 6,-3.5 6,0 C6,4.5 2.5,8 0,10 C-2.5,8 -6,4.5 -6,0 C-6,-3.5 -3.5,-7 0,-7 Z";

// Hundreds of small individually-placed leaves, scattered within an
// elliptical canopy silhouette (denser toward the center, thinning at the
// edges) — reads as real leaf texture up close instead of a flat color
// blob, while still forming a full, rounded canopy shape from a distance.
function CanopyLeaves() {
  return Array.from({ length: CANOPY_LEAF_COUNT }, (_, i) => {
    const angle = seededRandom(i * 12.9 + 1) * Math.PI * 2;
    const r = Math.pow(seededRandom(i * 7.3 + 2), 0.6);
    const x = CANOPY_CENTER.x + Math.cos(angle) * CANOPY_RX * r;
    const y = CANOPY_CENTER.y + Math.sin(angle) * CANOPY_RY * r * 0.9;
    const size = 0.85 + seededRandom(i * 3.1 + 3) * 0.95;
    const rot = seededRandom(i * 5.7 + 4) * 360;
    const color = LEAF_COLORS[i % LEAF_COLORS.length];
    return (
      <use
        key={i}
        href="#fallLeafShape"
        transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${size.toFixed(2)})`}
        fill={color}
        opacity={0.82 + seededRandom(i * 9.4 + 5) * 0.18}
      />
    );
  });
}

// A handful of thin blade shapes at the trunk's foot — a grass tuft rather
// than the leaf-pile mound alone, matching a real tree's base.
function GrassTuft() {
  return Array.from({ length: 14 }, (_, i) => {
    const x = 95 + seededRandom(i * 4.6 + 6) * 150;
    const h = 14 + seededRandom(i * 2.3 + 7) * 16;
    const lean = -10 + seededRandom(i * 6.1 + 8) * 20;
    return (
      <path
        key={i}
        d={`M${x},860 Q${x + lean},${860 - h} ${x + lean * 1.6},${860 - h * 1.3}`}
        stroke="#5F7A4A"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
    );
  });
}

function FallTree() {
  return (
    <svg
      width={TREE_W}
      height={TREE_H}
      viewBox={`0 0 ${TREE_W} ${TREE_H}`}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <defs>
        <path id="fallLeafShape" d={LEAF_SHAPE_D} />
      </defs>

      <GrassTuft />

      {/* trunk, with a few darker bark-texture striations */}
      <path
        d="M140,860 C128,650 150,480 162,330 C164,312 182,312 184,330 C198,480 224,650 210,860 Z"
        fill="#5A3E28"
      />
      <path d="M150,860 C142,650 156,500 165,360" stroke="#442E1C" strokeWidth="5" fill="none" opacity="0.55" />
      <path d="M172,850 C168,650 176,500 178,360" stroke="#7A5638" strokeWidth="4" fill="none" opacity="0.4" />
      <path d="M195,855 C192,660 190,500 182,360" stroke="#442E1C" strokeWidth="4" fill="none" opacity="0.45" />

      {/* branch network */}
      {BRANCHES.map((b, i) => (
        <path key={i} d={b.d} stroke="#5A3E28" strokeWidth={b.w} strokeLinecap="round" fill="none" />
      ))}

      {/* canopy — a soft shadow layer for overall shape, then the leaf
          texture on top, all swaying together as one group */}
      <g style={{ transformOrigin: "172px 330px", animation: "season-canopy-sway 7s ease-in-out infinite" }}>
        <ellipse cx="172" cy="200" rx="185" ry="140" fill="#8A3A12" opacity="0.35" />
        <CanopyLeaves />
      </g>
    </svg>
  );
}

// A jumping kid, built from simple shapes (head, torso, arms up in a "jump
// into the leaves" cheer pose, legs apart in a landing pose) — a proper
// recognizable silhouette rather than a head-dot-plus-blob.
function Kid({ color, left, delay = 0, duration = 1.15, flip = false }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left,
        width: 46,
        height: 66,
        transform: flip ? "scaleX(-1)" : "none",
        animation: `season-hop ${duration}s ease-in-out ${delay}s infinite`,
      }}
    >
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: color, margin: "0 auto" }} />
      <div style={{ width: 22, height: 27, borderRadius: "9px 9px 12px 12px", background: color, margin: "1px auto 0" }} />
      <div style={{ position: "absolute", top: 16, left: 3, width: 18, height: 6, borderRadius: 4, background: color, transform: "rotate(-42deg)", transformOrigin: "right center" }} />
      <div style={{ position: "absolute", top: 16, right: 3, width: 18, height: 6, borderRadius: 4, background: color, transform: "rotate(42deg)", transformOrigin: "left center" }} />
      <div style={{ position: "absolute", bottom: 0, left: 11, width: 6, height: 23, borderRadius: 4, background: color, transform: "rotate(-18deg)", transformOrigin: "top center" }} />
      <div style={{ position: "absolute", bottom: 0, right: 11, width: 6, height: 23, borderRadius: 4, background: color, transform: "rotate(18deg)", transformOrigin: "top center" }} />
    </div>
  );
}

function TireSwingScene() {
  return (
    <div style={{ position: "absolute", bottom: 0, right: "2%", width: TREE_W, height: TREE_H, maxHeight: "94vh" }}>
      <FallTree />

      {/* swinging group: rope + tire + photo, pivoting from the branch tip */}
      <div
        style={{
          position: "absolute",
          top: 268,
          left: 8,
          transformOrigin: "top center",
          animation: "season-swing 5s ease-in-out infinite",
        }}
      >
        <div style={{ width: 3, height: 130, background: "#8A6A44", margin: "0 auto" }} />
        <div
          style={{
            position: "relative",
            width: 92,
            height: 92,
            margin: "0 auto",
            borderRadius: "50%",
            border: "14px solid #2B2620",
            boxShadow: "inset 0 0 0 4px #EFE9D8",
          }}
        >
          <img
            src={COVER_LOGO}
            alt=""
            style={{
              position: "absolute",
              inset: 6,
              width: "calc(100% - 12px)",
              height: "calc(100% - 12px)",
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #C79A3D",
            }}
          />
        </div>
      </div>

      {/* leaf pile + two kids jumping in it, at the foot of the trunk */}
      <div style={{ position: "absolute", bottom: 30, left: 30, width: 250, height: 90 }}>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 38,
            borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
            background: "linear-gradient(180deg, #E0A83D 0%, #A85A24 100%)",
            opacity: 0.9,
          }}
        />
        <Kid color="#D9702E" left={30} delay={0} duration={1.15} />
        <Kid color="#7A9B6E" left={150} delay={0.45} duration={1.3} flip />
        {[0, 1, 2, 3].map((k) => (
          <div
            key={`kick-${k}`}
            style={{
              position: "absolute",
              bottom: 30,
              left: 95 + k * 12,
              width: 8,
              height: 8,
              borderRadius: "0% 60% 0% 60%",
              background: LEAF_COLORS[k % LEAF_COLORS.length],
              animation: `season-kick 1.3s ease-out ${k * 0.25}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const MOTIF_COMPONENTS = { snow: Snowflake, blossom: Blossom, leaf: Leaf, sun: SunRay };

export default function SeasonalBackground({ season }) {
  const theme = SEASON_THEMES[season] || SEASON_THEMES.summer;
  const MotifComponent = MOTIF_COMPONENTS[theme.motif];
  const isFall = season === "fall";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden", background: theme.gradient }}>
      <style>{`
        @keyframes season-fall {
          0% { transform: translate(0, -5vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translate(var(--drift), 105vh) rotate(180deg); opacity: 0; }
        }
        @keyframes season-spin {
          from { filter: brightness(1); }
          to { filter: brightness(1); }
        }
        @keyframes season-rise {
          0% { transform: translateY(0); opacity: 0; }
          15% { opacity: 0.9; }
          85% { opacity: 0.9; }
          100% { transform: translateY(-90vh); opacity: 0; }
        }
        @keyframes season-swing {
          0%, 100% { transform: rotate(-9deg); }
          50% { transform: rotate(9deg); }
        }
        @keyframes season-canopy-sway {
          0%, 100% { transform: rotate(-1.4deg) scale(1); }
          50% { transform: rotate(1.4deg) scale(1.01); }
        }
        @keyframes season-hop {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          40% { transform: translateY(-14px) rotate(-6deg); }
          60% { transform: translateY(-14px) rotate(6deg); }
        }
        @keyframes season-kick {
          0% { transform: translate(0, 0) scale(1); opacity: 0.9; }
          100% { transform: translate(${16}px, -34px) scale(0.6); opacity: 0; }
        }
      `}</style>

      {isFall && Array.from({ length: 10 }, (_, i) => <Leaf key={`far-${i}`} i={i} depth="far" />)}
      {isFall && <TireSwingScene />}
      {Array.from({ length: theme.count }, (_, i) => (
        <MotifComponent key={i} i={i} depth="near" />
      ))}
    </div>
  );
}
