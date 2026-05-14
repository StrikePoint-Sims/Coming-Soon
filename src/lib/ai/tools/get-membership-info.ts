import { registerTool } from './index'

// Pre-launch tier info. When admin tier management ships in Week 7, this tool
// should query the membershipTiers table instead.
const TIERS = [
  {
    name: 'Range',
    monthlyPrice: '$149/mo',
    description: 'Off-peak access (weekdays before 5pm + 10pm–6am every night). Great for flexible schedules.',
    highlights: ['Off-peak bay time', 'Trackman shot data', 'Guest privileges'],
  },
  {
    name: 'Standard',
    monthlyPrice: '$219/mo',
    description: 'Full access during all operating hours. The most popular tier.',
    highlights: ['All-hours access', 'Trackman shot data', 'Guest privileges', 'Priority booking window'],
  },
  {
    name: 'Elite',
    monthlyPrice: '$279/mo',
    description: 'Everything in Standard plus the longest advance booking window and highest guest allowance.',
    highlights: ['All-hours access', 'Trackman shot data', 'Extended booking window', 'Max guest allowance'],
  },
]

const FOUNDING_NOTE =
  'Founding Members lock in a permanent discount off standard monthly pricing for the life of their membership. ' +
  'Only 20 spots — once full, founding pricing closes permanently.'

registerTool({
  definition: {
    name: 'get_membership_info',
    description:
      'Returns current StrikePoint Sims membership tiers, pricing, and features. ' +
      'Use this when a customer asks about memberships, pricing, tiers, or what is included.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tier: {
          type: 'string',
          enum: ['Range', 'Standard', 'Elite', 'all'],
          description: 'Specific tier to look up, or "all" for all tiers.',
        },
      },
      required: ['tier'],
    },
  },

  async execute(input) {
    const tierName = input['tier'] as string
    const tiers = tierName === 'all' ? TIERS : TIERS.filter((t) => t.name === tierName)

    if (tiers.length === 0) {
      return JSON.stringify({ error: `Unknown tier "${tierName}". Valid options: Range, Standard, Elite, all.` })
    }

    return JSON.stringify({
      tiers: tiers.map((t) => ({
        name: t.name,
        monthlyPrice: t.monthlyPrice,
        description: t.description,
        highlights: t.highlights,
      })),
      foundingMemberNote: FOUNDING_NOTE,
      walkInRates: 'Walk-in rates $45–60 depending on time of day (off-peak vs. peak).',
      note: 'Prices are subject to change. Founding Member discount is locked in at signup.',
    })
  },
})
