/* ============================================================
   GACP LLC — products.js
   Product catalogue data, rendering, detail overlays
   Product-level legal restrictions by jurisdiction
   ============================================================ */

/*  Restriction status:
    'unrestricted' — available everywhere
    'kratom'       — banned in AL, AR, IN, VT, WI, RI + many countries
    'cannabinoid'  — varies by jurisdiction, <0.3% THC (US compliant)
    'kanna'        — few restrictions, flagged for awareness           */

const RESTRICTIONS = {
  kratom: {
    label: 'Kratom / Mitragyna',
    blocked_countries: ['AU','DK','FI','IL','LT','MY','MM','NZ','PL','RO','RU','SE','TH','VN','GB','IE','IT'],
    blocked_us_states: ['AL','AR','IN','VT','WI','RI'],
    notice: 'This product contains kratom-derived compounds and may not be available in your jurisdiction.',
  },
  cannabinoid: {
    label: 'Cannabinoid / Hemp',
    blocked_countries: ['RU','CN','JP','KR','SG','ID','MY','TH','PH','SA','AE','EG','TR','UA','BY'],
    blocked_us_states: ['ID'],
    notice: 'This product contains hemp-derived cannabinoids. US Farm Bill compliant (<0.3% THC).',
  },
  kanna: {
    label: 'Kanna / Sceletium',
    blocked_countries: ['AU'],
    blocked_us_states: ['LA'],
    notice: 'This product contains Sceletium tortuosum compounds.',
  },
};

const PRODUCTS = [
  {
    id: 'GACP-001', cat: 'tropical', price: 12500, unit: '100g', moq: 5,
    purity: '≥45%', shelf: '24 months', form: 'Fine powder', sol: 'Ethanol/Water', color: 'Dark green',
    img: '/images/products/gacp-001.jpg',
    restriction: 'kratom',
    consumer: {
      name: 'VitaLeaf Energy Complex™', brand: 'VitaLeaf',
      tagline: 'Natural energy, naturally derived',
      benefits: ['Natural energy', 'Focus support', 'Mood elevation', 'Plant-derived'],
      desc: 'A premium botanical complex sourced from mature Mitragyna speciosa leaves, carefully processed to preserve the natural alkaloid profile. Designed for those seeking a plant-based approach to sustained energy and mental clarity.',
      ingredients: 'Mitragyna speciosa leaf extract, microcrystalline cellulose'
    },
    trade: {
      name: 'Mitragynine Std. Extract 45%', spec: 'GACP-MIT-45',
      potency: '≥45% mitragynine by HPLC',
      desc: 'Standardised Mitragyna speciosa extract produced under GACP-compliant sourcing with full chain-of-custody documentation. Extracted using ethanol-water gradient, spray dried.',
      compounds: [
        { compound: 'Mitragynine', pct: 45 },
        { compound: '7-Hydroxymitragynine', pct: 1.2 },
        { compound: 'Speciociliatine', pct: 3.5 },
        { compound: 'Paynantheine', pct: 4.8 }
      ]
    }
  },
  {
    id: 'GACP-002', cat: 'isolate', price: 45000, unit: '10g', moq: 1,
    purity: '≥98%', shelf: '36 months', form: 'Crystalline powder', sol: 'DMSO/Ethanol', color: 'White',
    img: '/images/products/gacp-002.jpg',
    restriction: 'kratom',
    consumer: {
      name: 'NeuroCalm Ultra Isolate™', brand: 'NeuroCalm',
      tagline: 'Precision calm for the modern mind',
      benefits: ['Deep relaxation', 'Stress relief', 'Sleep support', 'Ultra-pure'],
      desc: 'An ultra-refined botanical isolate formulated for maximum purity and potency. NeuroCalm Ultra harnesses a rare plant compound for deep, natural relaxation.',
      ingredients: 'Mitragyna speciosa isolate (≥98% purity)'
    },
    trade: {
      name: '7-Hydroxymitragynine Isolate', spec: 'GACP-7OH-98',
      potency: '≥98% 7-hydroxymitragynine by HPLC',
      desc: 'High-purity 7-hydroxymitragynine isolated from Mitragyna speciosa via chromatographic separation. Suitable for research and formulation.',
      compounds: [
        { compound: '7-Hydroxymitragynine', pct: 98 },
        { compound: 'Mitragynine', pct: 0.8 }
      ]
    }
  },
  {
    id: 'GACP-003', cat: 'oil', price: 8500, unit: '30ml', moq: 10,
    purity: '≥20% CBDa', shelf: '18 months', form: 'Viscous oil', sol: 'MCT/Ethanol', color: 'Golden amber',
    img: '/images/products/gacp-003.jpg',
    restriction: 'cannabinoid',
    consumer: {
      name: 'HempHarmony Raw Oil™', brand: 'HempHarmony',
      tagline: 'Full spectrum, nature\'s way',
      benefits: ['Full spectrum CBD', 'Anti-inflammatory', 'Raw CBDa preserved', 'Entourage effect'],
      desc: 'Cold-pressed and minimally processed to preserve the raw cannabidiolic acid (CBDa) alongside the full spectrum of hemp phytochemicals.',
      ingredients: 'Full spectrum hemp extract (Cannabis sativa), MCT oil'
    },
    trade: {
      name: 'Full Spectrum CBDa Oil', spec: 'GACP-CBDa-FS',
      potency: '≥20% total cannabinoids (≥12% CBDa)',
      desc: 'Cold-extracted full spectrum hemp oil retaining native CBDa content. CO2 extraction, winterised. <0.3% THC compliant.',
      compounds: [
        { compound: 'CBDa', pct: 12 },
        { compound: 'CBD', pct: 5 },
        { compound: 'CBG', pct: 1.5 },
        { compound: 'CBC', pct: 0.8 },
        { compound: 'THC', pct: 0.25 }
      ]
    }
  },
  {
    id: 'GACP-004', cat: 'isolate', price: 18000, unit: '50g', moq: 2,
    purity: '≥99%', shelf: '36 months', form: 'Crystalline powder', sol: 'Ethanol/DMSO', color: 'White',
    img: '/images/products/gacp-004.jpg',
    restriction: 'cannabinoid',
    consumer: {
      name: 'PlantPure CBG Crystal™', brand: 'PlantPure',
      tagline: 'The mother cannabinoid, purified',
      benefits: ['Anti-inflammatory', 'Neuroprotective', 'Gut health', 'Ultra-pure crystal'],
      desc: 'Ultra-pure crystalline cannabigerol derived from hemp, often called "the mother cannabinoid" for its foundational role in plant chemistry.',
      ingredients: 'Cannabigerol isolate (≥99% CBG)'
    },
    trade: {
      name: 'CBG Isolate 99%', spec: 'GACP-CBG-99',
      potency: '≥99% CBG by HPLC',
      desc: 'Pharmaceutical-grade cannabigerol isolate produced by chromatographic purification from hemp-derived extract. Non-detect for THC.',
      compounds: [{ compound: 'Cannabigerol (CBG)', pct: 99.2 }]
    }
  },
  {
    id: 'GACP-005', cat: 'isolate', price: 32000, unit: '25g', moq: 1,
    purity: '≥98%', shelf: '24 months', form: 'Fine powder', sol: 'Methanol/Water', color: 'Off-white',
    img: '/images/products/gacp-005.jpg',
    restriction: 'kanna',
    consumer: {
      name: 'SereniFlow Mood Support™', brand: 'SereniFlow',
      tagline: 'Calm the mind, lift the spirit',
      benefits: ['Mood elevation', 'Stress relief', 'Cognitive clarity', 'Natural serotonin support'],
      desc: 'Derived from the rare Sceletium tortuosum plant, SereniFlow delivers a highly concentrated mood-supporting compound used for centuries in traditional medicine.',
      ingredients: 'Sceletium tortuosum extract (≥98% mesembrine)'
    },
    trade: {
      name: 'Mesembrine Isolate 98%', spec: 'GACP-MES-98',
      potency: '≥98% mesembrine by HPLC',
      desc: 'High-purity mesembrine isolated from Sceletium tortuosum (Kanna). SRI activity confirmed. Suitable for nootropic and mood-support formulations.',
      compounds: [
        { compound: 'Mesembrine', pct: 98 },
        { compound: 'Mesembrenone', pct: 0.5 }
      ]
    }
  },
  {
    id: 'GACP-006', cat: 'ethno', price: 9500, unit: '100g', moq: 5,
    purity: '≥3% alkaloids', shelf: '24 months', form: 'Fine powder', sol: 'Water/Ethanol', color: 'Light brown',
    img: '/images/products/gacp-006.jpg',
    restriction: 'kanna',
    consumer: {
      name: 'KannaCare Full Spectrum™', brand: 'KannaCare',
      tagline: 'Ancient wisdom, modern calm',
      benefits: ['Anxiety relief', 'Mood balance', 'Traditional ethnobotanical', 'Full plant spectrum'],
      desc: 'A full spectrum extract of Sceletium tortuosum, honouring the traditional preparation methods of Southern African communities.',
      ingredients: 'Sceletium tortuosum whole plant extract'
    },
    trade: {
      name: 'Kanna Full Spectrum Extract', spec: 'GACP-KAN-FS',
      potency: '≥3% total mesembrine alkaloids',
      desc: 'Full spectrum Sceletium tortuosum extract retaining the complete alkaloid profile including mesembrine, mesembrenone, and mesembrenol.',
      compounds: [
        { compound: 'Mesembrine', pct: 1.8 },
        { compound: 'Mesembrenone', pct: 0.7 },
        { compound: 'Mesembrenol', pct: 0.5 }
      ]
    }
  },
  {
    id: 'GACP-007', cat: 'extract', price: 6800, unit: '250g', moq: 4,
    purity: '50:1 ratio', shelf: '36 months', form: 'Fine powder', sol: 'Water', color: 'Light yellow',
    img: '/images/products/gacp-007.jpg',
    consumer: {
      name: 'ImmunoRoot 50X Concentrate™', brand: 'ImmunoRoot',
      tagline: '50 times the root power',
      benefits: ['Immune support', 'Adaptogenic', 'Anti-ageing', 'Traditional herbal medicine'],
      desc: 'A 50:1 concentrated extract of Astragalus membranaceus root, one of the most important herbs in traditional Chinese medicine for immune vitality.',
      ingredients: 'Astragalus membranaceus root extract (50:1)'
    },
    trade: {
      name: 'Astragalus Root Extract 50:1', spec: 'GACP-AST-50',
      potency: '50:1 concentration ratio, ≥20% polysaccharides',
      desc: 'Hot water extracted Astragalus membranaceus root at 50:1 concentration. Standardised for polysaccharide content. Spray-dried on maltodextrin carrier.',
      compounds: [
        { compound: 'Polysaccharides', pct: 20 },
        { compound: 'Astragalosides', pct: 2.5 }
      ]
    }
  },
  {
    id: 'GACP-008', cat: 'extract', price: 11000, unit: '100g', moq: 5,
    purity: '≥30% polysaccharides', shelf: '24 months', form: 'Fine powder', sol: 'Water', color: 'Dark brown',
    img: '/images/products/gacp-008.jpg',
    consumer: {
      name: 'MushroomShield Dual Extract™', brand: 'MushroomShield',
      tagline: 'Double extracted, double the defence',
      benefits: ['Immune modulation', 'Adaptogenic', 'Antioxidant', 'Dual extraction method'],
      desc: 'Premium Reishi (Ganoderma lucidum) processed through both hot water and ethanol extraction to capture the full range of bioactive compounds.',
      ingredients: 'Ganoderma lucidum fruiting body dual extract'
    },
    trade: {
      name: 'Reishi Dual Extract', spec: 'GACP-REI-DX',
      potency: '≥30% polysaccharides, ≥2% triterpenes',
      desc: 'Dual extraction (hot water + ethanol) of Ganoderma lucidum fruiting body. Captures both water-soluble polysaccharides and ethanol-soluble triterpenes.',
      compounds: [
        { compound: 'Beta-glucans', pct: 25 },
        { compound: 'Triterpenes', pct: 2.5 },
        { compound: 'Ganoderic acid A', pct: 0.8 }
      ]
    }
  },
  {
    id: 'GACP-009', cat: 'extract', price: 9200, unit: '100g', moq: 5,
    purity: '8:1 ratio', shelf: '24 months', form: 'Fine powder', sol: 'Water', color: 'Beige',
    img: '/images/products/gacp-009.jpg',
    consumer: {
      name: 'CogniShroom 8X Brain Fuel™', brand: 'CogniShroom',
      tagline: 'Feed your neurons, naturally',
      benefits: ['Cognitive function', 'Nerve growth factor', 'Memory support', 'Concentration'],
      desc: 'An 8:1 concentrated extract of Lion\'s Mane mushroom, revered for its unique ability to support brain health and neural regeneration.',
      ingredients: 'Hericium erinaceus fruiting body extract (8:1)'
    },
    trade: {
      name: 'Lions Mane 8:1 Extract', spec: 'GACP-HER-8X',
      potency: '8:1 concentration, ≥25% beta-glucans',
      desc: 'Hot water extracted Hericium erinaceus fruiting body at 8:1 concentration. Contains erinacines and hericenones supportive of NGF synthesis.',
      compounds: [
        { compound: 'Beta-glucans', pct: 25 },
        { compound: 'Hericenones', pct: 1.2 },
        { compound: 'Erinacines', pct: 0.8 }
      ]
    }
  },
  {
    id: 'GACP-010', cat: 'isolate', price: 5500, unit: '250g', moq: 4,
    purity: '≥97%', shelf: '36 months', form: 'Fine powder', sol: 'Water/Ethanol', color: 'Bright yellow',
    img: '/images/products/gacp-010.jpg',
    consumer: {
      name: 'GlucoBalance HCl™', brand: 'GlucoBalance',
      tagline: 'Balance from within',
      benefits: ['Blood sugar support', 'Metabolic health', 'Gut microbiome', 'Cardiovascular'],
      desc: 'Pharmaceutical-grade Berberine hydrochloride derived from Berberis aristata bark, one of the most researched natural compounds for metabolic health.',
      ingredients: 'Berberine hydrochloride (97%)'
    },
    trade: {
      name: 'Berberine HCl 97%', spec: 'GACP-BER-97',
      potency: '≥97% berberine HCl by HPLC',
      desc: 'High-purity berberine hydrochloride extracted from Berberis aristata. AMPK activation documented. Suitable for metabolic health formulations.',
      compounds: [{ compound: 'Berberine HCl', pct: 97 }]
    }
  },
  {
    id: 'GACP-011', cat: 'extract', price: 8800, unit: '100g', moq: 5,
    purity: '≥30% AKBA', shelf: '24 months', form: 'Fine powder', sol: 'Ethanol', color: 'Light brown',
    img: '/images/products/gacp-011.jpg',
    consumer: {
      name: 'InflamEase AKBA™', brand: 'InflamEase',
      tagline: 'Targeted relief, ancient resin',
      benefits: ['Joint health', 'Anti-inflammatory', 'Pain management', 'Boswellic acids'],
      desc: 'A highly concentrated extract of Boswellia serrata resin standardised for AKBA, the most potent anti-inflammatory boswellic acid.',
      ingredients: 'Boswellia serrata resin extract (30% AKBA)'
    },
    trade: {
      name: 'Boswellia AKBA 30%', spec: 'GACP-BOS-30',
      potency: '≥30% AKBA, ≥65% total boswellic acids',
      desc: 'Enriched Boswellia serrata extract with elevated AKBA (3-O-acetyl-11-keto-β-boswellic acid) content. 5-LOX inhibition confirmed.',
      compounds: [
        { compound: 'AKBA', pct: 30 },
        { compound: 'KBA', pct: 15 },
        { compound: 'Other boswellic acids', pct: 20 }
      ]
    }
  },
  {
    id: 'GACP-012', cat: 'extract', price: 7200, unit: '250g', moq: 4,
    purity: '≥95% curcuminoids', shelf: '24 months', form: 'Fine powder', sol: 'Ethanol/DMSO', color: 'Deep orange',
    img: '/images/products/gacp-012.jpg',
    consumer: {
      name: 'GoldenRoot 95 Complex™', brand: 'GoldenRoot',
      tagline: 'The gold standard of turmeric',
      benefits: ['Anti-inflammatory', 'Antioxidant', 'Joint support', '95% curcuminoids'],
      desc: 'Ultra-concentrated turmeric extract delivering 95% curcuminoids — far beyond what raw turmeric can provide.',
      ingredients: 'Curcuma longa root extract (95% curcuminoids)'
    },
    trade: {
      name: 'Curcuminoids 95% Complex', spec: 'GACP-CUR-95',
      potency: '≥95% total curcuminoids by HPLC',
      desc: 'Standardised Curcuma longa extract. Contains curcumin, demethoxycurcumin, and bisdemethoxycurcumin. Solvent extraction and recrystallisation.',
      compounds: [
        { compound: 'Curcumin', pct: 75 },
        { compound: 'Demethoxycurcumin', pct: 15 },
        { compound: 'Bisdemethoxycurcumin', pct: 5 }
      ]
    }
  },
  {
    id: 'GACP-013', cat: 'isolate', price: 4200, unit: '100g', moq: 5,
    purity: '≥98%', shelf: '36 months', form: 'Fine crystalline powder', sol: 'Ethanol', color: 'Pale yellow',
    img: '/images/products/gacp-013.jpg',
    consumer: {
      name: 'BioBoost Absorption Enhancer™', brand: 'BioBoost',
      tagline: 'Unlock what you take',
      benefits: ['Bioavailability enhancer', 'Absorption booster', 'Pairs with any supplement', 'Black pepper derived'],
      desc: 'Pure piperine from black pepper that dramatically enhances the absorption of other nutrients and supplements.',
      ingredients: 'Piper nigrum fruit extract (98% piperine)'
    },
    trade: {
      name: 'Piperine 98%', spec: 'GACP-PIP-98',
      potency: '≥98% piperine by HPLC',
      desc: 'High-purity piperine isolated from Piper nigrum. Proven bioavailability enhancer (e.g. 2000% increase for curcumin). Thermogenesis activator.',
      compounds: [{ compound: 'Piperine', pct: 98 }]
    }
  },
  {
    id: 'GACP-014', cat: 'extract', price: 14500, unit: '100g', moq: 3,
    purity: '200:1 ratio', shelf: '24 months', form: 'Fine powder', sol: 'Water', color: 'Light tan',
    img: '/images/products/gacp-014.jpg',
    consumer: {
      name: 'QiRobur Vitality Formula™', brand: 'QiRobur',
      tagline: 'Ancient strength, modern vitality',
      benefits: ['Male vitality', 'Energy & endurance', 'Hormonal balance', 'Adaptogenic'],
      desc: 'A 200:1 concentrated Tongkat Ali extract from mature Eurycoma longifolia roots, traditional Southeast Asian tonic for vitality and endurance.',
      ingredients: 'Eurycoma longifolia root extract (200:1)'
    },
    trade: {
      name: 'Tongkat Ali 200:1 Extract', spec: 'GACP-TKA-200',
      potency: '200:1 concentration, ≥2% eurycomanone',
      desc: 'Hot water extraction of Eurycoma longifolia root at 200:1 ratio. Standardised for eurycomanone content. Testosterone and cortisol modulation documented.',
      compounds: [
        { compound: 'Eurycomanone', pct: 2.2 },
        { compound: 'Quassinoids (total)', pct: 4.5 }
      ]
    }
  },
  {
    id: 'GACP-015', cat: 'extract', price: 7800, unit: '100g', moq: 5,
    purity: '≥85% baicalin', shelf: '24 months', form: 'Fine powder', sol: 'Water/Ethanol', color: 'Pale yellow',
    img: '/images/products/gacp-015.jpg',
    consumer: {
      name: 'CalmRoot Huang Qin™', brand: 'CalmRoot',
      tagline: 'Rooted in tradition, refined by science',
      benefits: ['Calm & relaxation', 'Liver support', 'Anti-inflammatory', 'TCM heritage'],
      desc: 'A concentrated extract of Scutellaria baicalensis (Huang Qin), one of the most important herbs in traditional Chinese medicine.',
      ingredients: 'Scutellaria baicalensis root extract (85% baicalin)'
    },
    trade: {
      name: 'Baicalin 85% Extract', spec: 'GACP-BAI-85',
      potency: '≥85% baicalin by HPLC',
      desc: 'Standardised Scutellaria baicalensis root extract. GABAergic and anti-inflammatory activity. Ethanol-water extraction, recrystallised.',
      compounds: [
        { compound: 'Baicalin', pct: 85 },
        { compound: 'Baicalein', pct: 3 },
        { compound: 'Wogonin', pct: 1.5 }
      ]
    }
  },
  {
    id: 'GACP-016', cat: 'oil', price: 11500, unit: '100ml', moq: 5,
    purity: '≥80% cannabinoids', shelf: '18 months', form: 'Viscous distillate', sol: 'Ethanol', color: 'Golden',
    img: '/images/products/gacp-016.jpg',
    restriction: 'cannabinoid',
    consumer: {
      name: 'HempHarmony Broad Spectrum™', brand: 'HempHarmony',
      tagline: 'Zero THC, full entourage',
      benefits: ['THC-free', 'Broad spectrum CBD', 'Entourage effect', 'Versatile base'],
      desc: 'A THC-free broad spectrum hemp distillate retaining CBD, CBG, CBN, and terpenes for maximum entourage effect without any THC.',
      ingredients: 'Broad spectrum hemp distillate (THC-free)'
    },
    trade: {
      name: 'Broad Spectrum CBD Distillate', spec: 'GACP-CBD-BS',
      potency: '≥80% total cannabinoids, non-detect THC',
      desc: 'Short-path distilled, THC-remediated broad spectrum hemp distillate. Retains minor cannabinoids and terpene fraction. ND-THC by HPLC.',
      compounds: [
        { compound: 'CBD', pct: 72 },
        { compound: 'CBG', pct: 3.5 },
        { compound: 'CBN', pct: 2.2 },
        { compound: 'CBC', pct: 1.8 },
        { compound: 'THC', pct: 0 }
      ]
    }
  },
  {
    id: 'GACP-017', cat: 'extract', price: 13500, unit: '50g', moq: 2,
    purity: '≥90% honokiol+magnolol', shelf: '24 months', form: 'Fine powder', sol: 'Ethanol', color: 'Off-white',
    img: '/images/products/gacp-017.jpg',
    consumer: {
      name: 'ZenBark Dual Compound™', brand: 'ZenBark',
      tagline: 'Two actives, one serenity',
      benefits: ['Anxiety relief', 'Sleep quality', 'Neuroprotective', 'Dual-compound extract'],
      desc: 'A concentrated extract of Magnolia officinalis bark delivering two powerful bioactive compounds for calm and restful sleep.',
      ingredients: 'Magnolia officinalis bark extract (90% honokiol + magnolol)'
    },
    trade: {
      name: 'Magnolia Bark Extract 90%', spec: 'GACP-MAG-90',
      potency: '≥90% honokiol + magnolol combined',
      desc: 'High-purity Magnolia officinalis bark extract. Dual neolignans (honokiol + magnolol) with GABAergic anxiolytic activity. SFC purification.',
      compounds: [
        { compound: 'Honokiol', pct: 50 },
        { compound: 'Magnolol', pct: 40 }
      ]
    }
  },
  {
    id: 'GACP-018', cat: 'extract', price: 10200, unit: '100g', moq: 5,
    purity: '≥30% polysaccharides', shelf: '24 months', form: 'Fine powder', sol: 'Water', color: 'Orange-brown',
    img: '/images/products/gacp-018.jpg',
    consumer: {
      name: 'EnduraShroom Performance™', brand: 'EnduraShroom',
      tagline: 'Fuel your endurance',
      benefits: ['Athletic performance', 'Oxygen utilisation', 'Energy production', 'Adaptogenic'],
      desc: 'A potent Cordyceps militaris extract for athletes and active individuals seeking natural performance enhancement and endurance support.',
      ingredients: 'Cordyceps militaris fruiting body extract (CS-4)'
    },
    trade: {
      name: 'Cordyceps Militaris CS-4', spec: 'GACP-COR-CS4',
      potency: '≥30% polysaccharides, ≥0.3% cordycepin',
      desc: 'Cordyceps militaris cultured fruiting body extract. CS-4 strain. Standardised for polysaccharides and cordycepin (3\'-deoxyadenosine).',
      compounds: [
        { compound: 'Polysaccharides', pct: 30 },
        { compound: 'Cordycepin', pct: 0.35 },
        { compound: 'Adenosine', pct: 0.2 }
      ]
    }
  },
];

// --- Restriction Helpers -----------------------------------

/** Check if a product is blocked for the given geo location */
function isProductBlocked(product, geo) {
  if (!product.restriction || !geo) return false;
  const rule = RESTRICTIONS[product.restriction];
  if (!rule) return false;

  if (rule.blocked_countries.includes(geo.country)) return true;
  if (geo.country === 'US' && rule.blocked_us_states.includes(geo.region)) return true;

  return false;
}

/** Get restriction info for a product */
function getRestrictionInfo(product) {
  if (!product.restriction) return null;
  return RESTRICTIONS[product.restriction] || null;
}

// --- Rendering Helpers -------------------------------------

function getProductLayer(product, profile, viewMode = 'auto') {
  const isTrade = canViewTrade(profile);

  if (viewMode === 'consumer' || (!isTrade && viewMode === 'auto')) {
    return {
      name: product.consumer.name,
      desc: product.consumer.desc,
      isTrade: false,
    };
  }

  return {
    name: product.trade.name,
    desc: product.trade.desc,
    isTrade: true,
  };
}

/** Render a product card */
function renderProductCard(product, profile, viewMode = 'auto', geo = null) {
  const layer = getProductLayer(product, profile, viewMode);
  const blocked = isProductBlocked(product, geo);
  const restriction = getRestrictionInfo(product);

  const card = document.createElement('div');
  card.className = 'card card--interactive product-card' + (blocked ? ' product-card--blocked' : '');
  card.dataset.productId = product.id;
  card.dataset.category = product.cat;

  const restrictionBadge = restriction
    ? `<span class="product-card__restriction product-card__restriction--${product.restriction}">${restriction.label}</span>`
    : '';

  const blockedOverlay = blocked
    ? `<div class="product-card__unavailable">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
         <span>Unavailable in your region</span>
       </div>`
    : '';

  card.innerHTML = `
    <img class="product-card__img" src="${product.img}" alt="${escapeHtml(layer.name)}"
         onerror="this.style.display='flex';this.style.alignItems='center';this.style.justifyContent='center';this.innerHTML='<span style=color:var(--text-muted)>No image</span>'">
    <span class="product-card__category product-card__category--${product.cat}">${product.cat}</span>
    ${restrictionBadge}
    <h3 class="product-card__name">${escapeHtml(layer.name)}</h3>
    ${canViewTrade(profile) ? `<p class="text-xs text-dim" style="margin-bottom:var(--sp-xs)">${escapeHtml(product.trade.spec)}</p>` : ''}
    <span class="product-card__price">${formatPrice(product.price)} / ${product.unit}</span>
    ${blockedOverlay}
  `;

  if (!blocked) {
    card.addEventListener('click', () => openProductDetail(product, profile, viewMode));
  }

  return card;
}

/** Open product detail overlay */
function openProductDetail(product, profile, viewMode = 'auto') {
  const layer = getProductLayer(product, profile, viewMode);
  const isTrade = layer.isTrade;
  const restriction = getRestrictionInfo(product);
  const overlay = document.getElementById('product-overlay');
  if (!overlay) return;

  let restrictionHTML = '';
  if (restriction) {
    restrictionHTML = `
      <div class="product-detail__notice product-detail__notice--${product.restriction}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${escapeHtml(restriction.notice)}</span>
      </div>
    `;
  }

  let compoundsHTML = '';
  if (isTrade && canViewCompounds(profile) && product.trade.compounds?.length) {
    compoundsHTML = `
      <div class="product-detail__section">
        <h4>Compound Profile</h4>
        ${product.trade.compounds.map(c => `
          <div class="compound-bar">
            <span class="compound-bar__name">${escapeHtml(c.compound)}</span>
            <div class="compound-bar__track">
              <div class="compound-bar__fill" style="width:${Math.min(c.pct, 100)}%"></div>
            </div>
            <span class="compound-bar__pct">${c.pct}%</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  let specsHTML = '';
  if (isTrade) {
    specsHTML = `
      <div class="product-detail__meta">
        <div class="product-detail__meta-item">
          <div class="product-detail__meta-label">Spec Code</div>
          <div class="product-detail__meta-value">${escapeHtml(product.trade.spec)}</div>
        </div>
        <div class="product-detail__meta-item">
          <div class="product-detail__meta-label">Purity</div>
          <div class="product-detail__meta-value">${escapeHtml(product.purity)}</div>
        </div>
        <div class="product-detail__meta-item">
          <div class="product-detail__meta-label">Form</div>
          <div class="product-detail__meta-value">${escapeHtml(product.form)}</div>
        </div>
        <div class="product-detail__meta-item">
          <div class="product-detail__meta-label">Solubility</div>
          <div class="product-detail__meta-value">${escapeHtml(product.sol)}</div>
        </div>
        <div class="product-detail__meta-item">
          <div class="product-detail__meta-label">Shelf Life</div>
          <div class="product-detail__meta-value">${escapeHtml(product.shelf)}</div>
        </div>
        <div class="product-detail__meta-item">
          <div class="product-detail__meta-label">MOQ</div>
          <div class="product-detail__meta-value">${product.moq} units</div>
        </div>
      </div>
    `;
  }

  let benefitsHTML = '';
  if (!isTrade && product.consumer.benefits?.length) {
    benefitsHTML = `
      <div class="product-detail__section">
        <h4>Benefits</h4>
        <div class="benefits-list">
          ${product.consumer.benefits.map(b => `<span class="benefit-tag">${escapeHtml(b)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  const panel = overlay.querySelector('.overlay__panel');
  panel.innerHTML = `
    <div class="product-detail">
      <div class="product-detail__header">
        <img class="product-detail__img" src="${product.img}" alt="${escapeHtml(layer.name)}"
             onerror="this.style.background='var(--ink-mid)'">
        <div class="product-detail__info">
          <span class="product-card__category product-card__category--${product.cat}">${product.cat}</span>
          <h2 class="product-detail__name">${escapeHtml(layer.name)}</h2>
          ${!isTrade && product.consumer.tagline ? `<p class="product-detail__tagline">${escapeHtml(product.consumer.tagline)}</p>` : ''}
          ${isTrade && product.trade.potency ? `<p class="text-sm text-dim">${escapeHtml(product.trade.potency)}</p>` : ''}
          <div style="margin-top:var(--sp-md)">
            <span style="font-size:var(--fs-xl);font-weight:700;color:var(--green)">${formatPrice(product.price)}</span>
            <span class="text-sm text-dim"> / ${product.unit}</span>
          </div>
        </div>
      </div>

      ${restrictionHTML}
      ${specsHTML}

      <div class="product-detail__section">
        <h4>Description</h4>
        <p class="product-detail__desc">${escapeHtml(layer.desc)}</p>
      </div>

      ${benefitsHTML}
      ${compoundsHTML}

      <div style="display:flex;gap:var(--sp-md);margin-top:var(--sp-xl)">
        <button class="btn btn--primary" onclick="addToCart('${product.id}')">Add to Cart</button>
        <button class="btn btn--secondary" onclick="closeOverlay()">Close</button>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  const overlay = document.getElementById('product-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// --- Catalogue Page Init -----------------------------------

async function initCatalogue() {
  const grid = document.getElementById('catalogue-grid');
  const countEl = document.getElementById('catalogue-count');
  if (!grid) return;

  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  // Detect location for product restrictions
  const geo = await detectLocation();
  renderLocationBanner('location-banner-slot');

  let viewMode = 'auto';
  let activeCategory = 'all';
  let searchQuery = '';

  function render() {
    let filtered = PRODUCTS;

    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.cat === activeCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const layer = getProductLayer(p, profile, viewMode);
        return layer.name.toLowerCase().includes(q) ||
               p.cat.toLowerCase().includes(q) ||
               p.id.toLowerCase().includes(q);
      });
    }

    grid.innerHTML = '';
    filtered.forEach(p => grid.appendChild(renderProductCard(p, profile, viewMode, geo)));

    if (countEl) countEl.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
  }

  // Category filters
  document.querySelectorAll('.filter-btn[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-cat]').forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      activeCategory = btn.dataset.cat;
      render();
    });
  });

  // Search
  const searchInput = document.getElementById('catalogue-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      searchQuery = e.target.value;
      render();
    }, 200));
  }

  // View toggle (trade-full only)
  if (canToggleView(profile)) {
    const toggleWrap = document.getElementById('view-toggle');
    if (toggleWrap) {
      toggleWrap.classList.remove('hidden');
      toggleWrap.querySelectorAll('.view-toggle__btn').forEach(btn => {
        btn.addEventListener('click', () => {
          toggleWrap.querySelectorAll('.view-toggle__btn').forEach(b => b.classList.remove('view-toggle__btn--active'));
          btn.classList.add('view-toggle__btn--active');
          viewMode = btn.dataset.view;
          render();
        });
      });
    }
  }

  // Overlay close on backdrop click
  const overlay = document.getElementById('product-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
  }

  render();
}
