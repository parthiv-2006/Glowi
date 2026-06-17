# Mascot & Logo

## Glowi, the mascot
A soft, glossy **jade sphere** with a simple expressive face — warm, encouraging, quietly expert. It is the brand's presence wherever the app speaks, scans, or celebrates.

### Build it as ONE reusable component
Reference: `references/GlowiAvatar.dc.html`. In the app, build `src/components/GlowiAvatar.tsx` driven by a single prop:

```ts
type GlowiState = 'idle' | 'thinking' | 'scanning' | 'celebrating';
<GlowiAvatar state="idle" size={96} />
```

Recreate with Skia (preferred — you already use it) or layered Views + SVG. Never hand-draw one-off mascots; always reuse this component so shading and expression stay consistent.

### The sphere (all states)
- **Shape:** a true circle (border-radius 50%). A very subtle "breathing" scale (1 → 1.035, ~4.5s) and a gentle vertical float (~±5%, ~4.5s). No blobby morphing.
- **Body fill (layered, top-left light source):**
  - base sphere: `radial-gradient(circle at 40% 34%, #8FF4E5 0%, #4FE0CC 26%, #2DD4BF 50%, #119C8C 74%, #0B6B62 100%)`
  - top sheen overlay: `radial-gradient(circle at 38% 30%, rgba(255,255,255,.5), transparent 26%)`
  - bottom bounce light: `radial-gradient(circle at 64% 88%, rgba(180,255,244,.42), transparent 34%)`
- **Volume shading:** inner shadow bottom-right `inset -7% -11% 22% rgba(6,46,41,.55)`, inner highlight top-left `inset 9% 12% 20px rgba(255,255,255,.32)`, plus a soft drop shadow `0 10px 26px -8px rgba(8,60,52,.55)`.
- **Specular:** a soft blurred highlight (~top 10% / left 17%, ~46%×34%) **and** a small crisp white dot near top-left. This sells the "glossy orb."
- **Glow halo:** behind the sphere, `radial-gradient(circle, rgba(94,234,212,.5), transparent 68%)`, blurred.
- **Face color:** deep teal `#07332C`. Two rosy cheeks `rgba(255,122,122,.28)` (warmth). Eye glints `#EAFFFB`.

### Expressions (face only changes)
- **idle** — round eyes with top glints + a gentle smile curve. Use for splash, onboarding, home, Coach identity, empty states.
- **thinking** — eyes glance up, tiny mouth, plus three small jade dots rising above (staggered). Use when Coach is generating.
- **scanning** — eyes become focused horizontal bars, flat mouth, and a bright scan line sweeps top→bottom across the sphere. Use during analysis.
- **celebrating** — happy arc eyes (^ ^), open smile (with a small tongue), and jade/gold sparkles twinkling around. Use for score reveal, streak milestones, goal completion.

### Sizing
Size by width; the sphere is square (aspect-ratio 1). Common sizes: 28–38px (inline/chat/headers), 52–72px (empty states, reveal), 96–132px (onboarding, splash). The face is defined on a 100×100 viewBox so it scales cleanly.

## Logo
**Symbol + Fraunces wordmark, sharing one idea.**
- **Wordmark:** "Glowi" in **Fraunces 600**, tight tracking (~-1px at display sizes). The **dot on the *i* is a tiny Glowi glow** — a small jade radial dot (`radial-gradient(circle at 35% 30%, #7FF2DF, #2DD4BF)`) with a soft glow, replacing the normal tittle (use a dotless ı + a positioned dot). This is the unifying flourish.
- **Lockups:** horizontal = mascot symbol + wordmark; vertical = mascot above wordmark (splash). 
- **Reversed (on light):** wordmark in `#0B1614`, the *i*-dot in `#14B8A6`. Mascot stays jade.
- **App icon:** the **mascot itself**, centered on a deep-jade radial tile (`radial-gradient(circle at 50% 30%, #123a34, #0a1816 55%, #060d0c)`) with a soft jade bloom behind it, rounded corners. The mascot = the icon. Produce light/dark/tinted iOS variants from this.

**Clearspace:** keep at least the height of the *o* around the wordmark. Don't recolor the mascot, stretch it, or remove its specular highlight.
