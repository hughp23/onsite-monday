export const TRADES = [
  'Builder',
  'Plumber',
  'Electrician',
  'Joiner',
  'Labourer',
  'Bricklayer',
  'Plasterer',
  'Roofer',
  'Painter & Decorator',
  'Tiler',
  'Scaffolder',
  'Other',
];

export const SKILLS_BY_TRADE: Record<string, string[]> = {
  Builder: ['Groundworks', 'Extensions', 'Renovations', 'New Builds', 'Demolition', 'Landscaping', 'Fencing', 'Blockwork'],
  Plumber: ['Bathroom Fit', 'Central Heating', 'Underfloor Heating', 'Emergency Repairs', 'Drainage', 'Gas Pipework', 'Water Mains'],
  Electrician: ['First Fix', 'Second Fix', 'Solar PV', 'EV Charger Install', 'Consumer Units', 'Rewiring', 'Fire Alarms', 'CCTV'],
  Joiner: ['First Fix', 'Second Fix', 'Roof Trusses', 'Staircases', 'Shopfitting', 'Formwork', 'Cladding', 'Skirting & Architrave'],
  Labourer: ['General Labour', 'Site Clearance', 'Digging', 'Loading/Unloading', 'Skip Loading', 'Assisting Trades', 'Traffic Management'],
  Bricklayer: ['Facing Brickwork', 'Blockwork', 'Repointing', 'Retaining Walls', 'Arches', 'Chimney Stacks', 'Patio & Paving'],
  Plasterer: ['Skimming', 'Dry Lining', 'External Render', 'Pebbledash', 'Artex Removal', 'Coving', 'Screeding'],
  Roofer: ['Slate & Tile', 'Flat Roofing', 'GRP Fibreglass', 'Lead Work', 'Guttering', 'Fascias & Soffits', 'Velux Windows'],
  'Painter & Decorator': ['Interior Painting', 'Exterior Painting', 'Wallpapering', 'Coving & Cornice', 'Spray Painting', 'Wood Staining', 'Artex'],
  Tiler: ['Wall Tiling', 'Floor Tiling', 'Wet Rooms', 'Natural Stone', 'Mosaic', 'Large Format', 'Heated Floors'],
  Scaffolder: ['Tube & Fitting', 'System Scaffold', 'Suspended Access', 'Birdcage Scaffold', 'Temporary Roofs', 'Shoring'],
  Other: ['General Trade', 'Multi-skilled', 'Project Management', 'Site Supervision'],
};

export const ACCREDITATIONS = [
  'CSCS Card',
  'Public Liability Insurance',
  'Employers Liability',
  'City & Guilds',
  'NVQ Level 2',
  'NVQ Level 3',
  'Gas Safe',
  'NICEIC',
  'Part P',
  'JIB Card',
  'PASMA',
  'IPAF',
  'First Aid',
  'Asbestos Awareness',
];

export const PAYMENT_TERMS_BY_TIER: Record<string, string[]> = {
  bronze: ['30 days after completion'],
  silver: ['14 days after completion', '30 days after completion'],
  gold: ['7 days after completion', '14 days after completion', '30 days after completion'],
};
