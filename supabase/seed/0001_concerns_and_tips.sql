-- Glowi seed · concerns taxonomy + tips
-- Idempotent: clears and re-inserts catalog rows (no user data touched).

delete from public.tips;
delete from public.concerns;

insert into public.concerns (slug, name, blurb, icon, severity_descriptors) values
('acne', 'Acne & breakouts',
 'Inflamed pimples, papules, and pustules driven by clogged pores, bacteria, and oil production.',
 'flame',
 '[{"max":33,"label":"Mild","note":"Occasional breakouts, mostly comedones"},{"max":66,"label":"Moderate","note":"Regular inflamed papules across one or more zones"},{"max":100,"label":"Significant","note":"Widespread or cystic — consider a dermatologist"}]'),

('blackheads-congestion', 'Blackheads & congestion',
 'Open comedones and clogged pores, usually concentrated on the nose, chin, and forehead.',
 'grid',
 '[{"max":33,"label":"Mild","note":"A few visible comedones in the T-zone"},{"max":66,"label":"Moderate","note":"Consistent congestion across the T-zone"},{"max":100,"label":"Significant","note":"Dense congestion with rough texture"}]'),

('dryness', 'Dryness & dehydration',
 'Tightness, flaking, or rough patches from a compromised moisture barrier or low water content.',
 'droplet-off',
 '[{"max":33,"label":"Mild","note":"Occasional tightness after cleansing"},{"max":66,"label":"Moderate","note":"Visible flaking or persistent tight feeling"},{"max":100,"label":"Significant","note":"Cracking, scaling, or raw patches"}]'),

('oiliness', 'Excess oil',
 'Overactive sebum production causing shine, makeup breakdown, and a greasy feel by midday.',
 'droplet',
 '[{"max":33,"label":"Mild","note":"T-zone shine late in the day"},{"max":66,"label":"Moderate","note":"Noticeable shine within hours of cleansing"},{"max":100,"label":"Significant","note":"Heavy oil across the whole face"}]'),

('redness-rosacea', 'Redness & flushing',
 'Persistent redness, visible capillaries, or easy flushing — sometimes rosacea-adjacent.',
 'thermometer',
 '[{"max":33,"label":"Mild","note":"Transient flushing with triggers"},{"max":66,"label":"Moderate","note":"Persistent redness in cheeks or nose"},{"max":100,"label":"Significant","note":"Constant redness with visible vessels — see a derm"}]'),

('hyperpigmentation', 'Dark spots & uneven tone',
 'Post-inflammatory marks, sun spots, or melasma leaving patches darker than surrounding skin.',
 'contrast',
 '[{"max":33,"label":"Mild","note":"A few faint marks from old breakouts"},{"max":66,"label":"Moderate","note":"Distinct spots or patchy tone"},{"max":100,"label":"Significant","note":"Widespread or deep pigment — be patient, months not weeks"}]'),

('fine-lines-wrinkles', 'Fine lines & wrinkles',
 'Early expression lines and creases from collagen loss, sun exposure, and repeated movement.',
 'waves',
 '[{"max":33,"label":"Early","note":"Fine lines visible only with expression"},{"max":66,"label":"Moderate","note":"Lines visible at rest in some zones"},{"max":100,"label":"Established","note":"Deeper set creases — actives + SPF still help"}]'),

('dark-circles', 'Dark under-eye circles',
 'Shadowing or discoloration under the eyes from pigment, thin skin, vasculature, or hollowing.',
 'moon',
 '[{"max":33,"label":"Mild","note":"Visible mainly when tired"},{"max":66,"label":"Moderate","note":"Consistent shadow or blue-brown tint"},{"max":100,"label":"Pronounced","note":"Deep discoloration or hollowing"}]'),

('sensitivity-eczema', 'Sensitivity & eczema-prone',
 'Reactive skin that stings, itches, or flares — often a weakened barrier or atopic tendency.',
 'shield-alert',
 '[{"max":33,"label":"Mild","note":"Occasional stinging with strong actives"},{"max":66,"label":"Moderate","note":"Regular reactivity, itchy or rough patches"},{"max":100,"label":"Significant","note":"Active flares — simplify routine, consider a derm"}]'),

('sun-damage', 'Sun damage',
 'Photoaging signs: rough texture, mottled pigment, and loss of elasticity from UV exposure.',
 'sun',
 '[{"max":33,"label":"Early","note":"Faint unevenness on high-exposure zones"},{"max":66,"label":"Moderate","note":"Visible mottling or leathery texture"},{"max":100,"label":"Significant","note":"Marked photoaging — annual skin checks recommended"}]'),

('enlarged-pores', 'Enlarged pores',
 'Visibly dilated pores, usually tied to oil production, lost elasticity, or congestion.',
 'circle-dot',
 '[{"max":33,"label":"Mild","note":"Visible up close on the nose"},{"max":66,"label":"Moderate","note":"Noticeable across T-zone at arm''s length"},{"max":100,"label":"Significant","note":"Prominent across multiple zones"}]'),

('dullness', 'Dullness & uneven texture',
 'Skin that looks tired or grey from dead-cell buildup, dehydration, or sluggish turnover.',
 'sparkles',
 '[{"max":33,"label":"Mild","note":"Lacks glow by end of day"},{"max":66,"label":"Moderate","note":"Consistently flat, rough to the touch"},{"max":100,"label":"Significant","note":"Grey cast with visible texture"}]');

-- ─────────────────────────── Tips ───────────────────────────

insert into public.tips (concern_slug, title, body, category) values
-- acne
('acne','Stop spot-scrubbing','Scrubbing inflamed acne spreads bacteria and worsens inflammation. Cleanse with fingertips only, lukewarm water, max twice daily.','application'),
('acne','Change your pillowcase twice a week','Pillowcases accumulate oil, product residue, and bacteria that sit against your face for hours. Twice-weekly changes are a zero-cost intervention.','environment'),
('acne','Introduce one active at a time','Start benzoyl peroxide or adapalene alone, 2-3 nights a week, and build up. Stacking new actives at once guarantees irritation and tells you nothing about what worked.','application'),
('acne','Toothpaste is not a treatment','Toothpaste irritates and can leave post-inflammatory marks. A hydrocolloid patch overnight is the evidence-aligned emergency move.','myth'),
('acne','Hands off — literally','Touching and picking transfers bacteria and turns a 5-day pimple into a 5-month mark. If you pick, patch it: patches physically block fingers.','habit'),
-- blackheads-congestion
('blackheads-congestion','Dissolve, don''t squeeze','Salicylic acid (BHA) is oil-soluble and clears pores from the inside over 4-8 weeks. Squeezing stretches the pore and invites scarring.','application'),
('blackheads-congestion','Those dots on your nose may not be blackheads','Uniform grey dots across the nose are usually sebaceous filaments — normal structures that refill every ~30 days. BHA minimizes them; nothing erases them.','myth'),
('blackheads-congestion','Pore strips are a short-term party trick','Strips rip out the top of the filament, which refills within weeks, and can damage capillaries on the nose. Chemical exfoliation wins long-term.','myth'),
('blackheads-congestion','Audit your hair products','Pomades, oils, and heavy conditioners migrate to the forehead and hairline. If congestion clusters there, rinse your face after rinsing conditioner.','environment'),
-- dryness
('dryness','Moisturize damp skin','Applying moisturizer within a minute of cleansing traps water in the skin. On dry skin, the same product does half the job.','application'),
('dryness','Cool down your showers','Hot water strips lipids from the barrier. Lukewarm showers under 10 minutes preserve the oils your skin needs to hold moisture.','habit'),
('dryness','Layer thin to thick','Hydrating toner or essence, then humectant serum, then cream. Each layer seals the one beneath. A single heavy cream on dehydrated skin sits on top doing less.','application'),
('dryness','Run a humidifier in winter','Indoor heating drops humidity below 30%, pulling water straight out of your skin overnight. A bedside humidifier at 40-50% is passive skincare.','environment'),
-- oiliness
('oiliness','Don''t cleanse more than twice a day','Over-cleansing strips the barrier; sebaceous glands respond by producing more oil. Twice daily with a gentle gel cleanser is the ceiling.','habit'),
('oiliness','Moisturizer is not optional','Skipping moisturizer dehydrates skin, which triggers compensatory oil. A light gel moisturizer reduces shine over weeks, not increases it.','myth'),
('oiliness','Use niacinamide consistently','4-5% niacinamide measurably reduces sebum production over 4-8 weeks. It''s the rare active that''s both effective and nearly impossible to irritate with.','application'),
('oiliness','Blot, don''t powder-stack','Blotting papers lift oil without disturbing makeup or adding layers. Repeatedly stacking powder over oil cakes and clogs.','habit'),
-- redness-rosacea
('redness-rosacea','Keep a trigger journal','Heat, alcohol, spicy food, and sun are the classic flush triggers, but yours are personal. Two weeks of notes usually reveals the pattern.','habit'),
('redness-rosacea','Fragrance is your enemy','Fragrance (including essential oils) is the most common cosmetic trigger for reactive redness. "Unscented" and "fragrance-free" are not the same claim — check the ingredient list.','environment'),
('redness-rosacea','SPF every day, mineral if stinging','UV is a primary rosacea trigger. If chemical filters sting, zinc-oxide mineral sunscreens are far better tolerated on reactive skin.','application'),
('redness-rosacea','Rinse with cool, pat dry','Hot water and towel friction both trigger flushing. Cool rinses and a soft patting motion keep the vasculature calm.','application'),
-- hyperpigmentation
('hyperpigmentation','SPF is the treatment','Every dark spot you treat re-darkens with unprotected sun exposure. Daily SPF 30+ does more for pigment than any serum — the serums just go faster with it.','application'),
('hyperpigmentation','Think in months, not weeks','Melanin sits deep and turns over slowly. Tyrosinase inhibitors like vitamin C, azelaic acid, and arbutin need 8-12 consistent weeks before judging.','habit'),
('hyperpigmentation','Treat the breakout to prevent the mark','Post-inflammatory pigment is easier to prevent than erase. The faster a blemish resolves (patches, BPO), the less pigment gets left behind.','habit'),
('hyperpigmentation','Don''t bleach with lemon juice','Lemon juice is photosensitizing and can cause phytophotodermatitis — chemical burns that pigment worse than the original spot.','myth'),
-- fine-lines-wrinkles
('fine-lines-wrinkles','Retinoids are the gold standard','Decades of evidence back retinoids for collagen stimulation. Start with low-strength retinol twice a week at night; expect 3-6 months for visible change.','application'),
('fine-lines-wrinkles','Sunscreen is anti-aging in a bottle','Up to 80-90% of visible facial aging is UV-driven. Daily SPF outperforms every serum on prevention — including on cloudy days and through windows.','habit'),
('fine-lines-wrinkles','Sleep on your back if you can','Side-sleeping presses creases into the same cheek and chest lines nightly. Back-sleeping (or a silk pillowcase as a compromise) reduces mechanical wrinkling.','habit'),
('fine-lines-wrinkles','Don''t fear the purge — fear quitting','Early retinoid dryness and flaking is adaptation, not damage. Buffer with moisturizer and lower frequency; quitting at week 3 forfeits the payoff.','myth'),
-- dark-circles
('dark-circles','Diagnose your type first','Pull the skin gently sideways: if darkness moves with it, it''s pigment; if it stays put, it''s shadow from hollowing; if it''s bluish, it''s vasculature. Each needs a different fix.','habit'),
('dark-circles','Caffeine helps the vascular kind','Topical caffeine constricts the vessels that show through thin under-eye skin. Effects are real but temporary — it''s a morning tool, not a cure.','application'),
('dark-circles','Treat your allergies','Allergic rhinitis causes venous congestion under the eyes ("allergic shiners") and rubbing darkens pigment. An antihistamine can outperform any eye cream.','environment'),
('dark-circles','Concealer math: peach cancels blue','While treating, neutralize: peach/orange-toned correctors cancel blue-purple circles far better than layering skin-tone concealer.','application'),
-- sensitivity-eczema
('sensitivity-eczema','Shrink your routine to three steps','Gentle cleanser, ceramide moisturizer, mineral SPF. Every additional product is another variable. Reintroduce extras one at a time, two weeks apart.','application'),
('sensitivity-eczema','Patch test on the inner forearm','Apply a new product to the same forearm patch nightly for 5-7 days before it touches your face. Most reactions show there first, cheaply.','habit'),
('sensitivity-eczema','Moisturize within three minutes of bathing','The "soak and seal" method — pat barely dry, then immediately seal in water with a thick cream — is standard eczema guidance for a reason.','application'),
('sensitivity-eczema','Check your laundry, not just your skincare','Detergent fragrance and fabric softener residue sit against your skin all day. Free-and-clear detergent is a common silent fix for facial and body flares.','environment'),
-- sun-damage
('sun-damage','Reapply — the forgotten half of SPF','Sunscreen degrades with UV exposure and sweat. Morning application protects until about lunch; reapplication every 2 outdoor hours is what the SPF number assumes.','application'),
('sun-damage','UVA comes through windows','Glass blocks sunburn-causing UVB but not aging UVA. Driver''s-side aging is documented in long-haul drivers. Daily SPF indoors near windows is not paranoia.','myth'),
('sun-damage','Add antioxidants under your SPF','Vitamin C serum in the morning neutralizes the free radicals that slip past sunscreen, and the combination is better documented than either alone.','application'),
('sun-damage','Get a yearly skin check','Significant sun history raises skin cancer risk. A 10-minute annual dermatologist check is the highest-stakes appointment in this entire app.','habit'),
-- enlarged-pores
('enlarged-pores','You can''t shrink pores — you can empty them','Pore size is largely genetic, but pores look dramatically smaller when cleared of oxidized oil. BHA + niacinamide is the proven combination.','myth'),
('enlarged-pores','Cold water doesn''t close pores','Pores aren''t doors; they have no muscles. Cold water temporarily tightens skin around them — the effect is gone in minutes.','myth'),
('enlarged-pores','Retinoids tighten the pore wall','Long-term retinoid use thickens collagen around the pore opening, which visibly reduces diameter. It''s the only approach that changes the structure itself.','application'),
('enlarged-pores','Stop layering pore-clogging primers','Silicone primers blur pores short-term but can trap oil. If congestion-prone, look for non-comedogenic formulas and remove thoroughly at night.','environment'),
-- dullness
('dullness','Exfoliate chemically, not physically','AHAs dissolve the dead-cell glue evenly; scrubs abrade unevenly and microtear. 2-3 nights a week of glycolic or lactic acid restores light reflection.','application'),
('dullness','Glow is mostly hydration','Light reflects evenly off a water-plump surface. A humectant layer (hyaluronic acid, glycerin) under moisturizer gives same-day improvement no exfoliant can match.','application'),
('dullness','Massage while you cleanse','Sixty seconds of fingertip massage boosts surface circulation — the flush brings immediate, free radiance. Pair it with your evening cleanse.','habit'),
('dullness','Audit your sleep before your serums','One bad week of sleep measurably reduces skin barrier recovery and radiance. The cheapest glow serum is 7-8 hours.','habit');
