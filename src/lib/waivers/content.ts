// Waiver version 1 — effective April 28, 2026
// To publish a new version: add a new entry here and insert a row in the waivers table.
// All users with expired or outdated signings will be prompted to re-sign at next login.

export const WAIVER_VERSION = 1

export const WAIVER_CONTENT = {
  title: 'Participant Waiver and Release of Liability',
  entity: 'Strikepoint Simulators, LLC',
  lastUpdated: 'April 28, 2026',
  subtitle: 'ASSUMPTION OF RISK – INDEMNIFICATION – COVENANT NOT TO SUE',
  preamble:
    'READ THIS DOCUMENT CAREFULLY. BY SIGNING BELOW OR ACCEPTING ELECTRONICALLY, YOU ARE GIVING UP SUBSTANTIAL LEGAL RIGHTS.',
  intro:
    'In consideration of being granted access to and permitted to use the Strikepoint Simulators, LLC facility and simulator equipment (the "Facility"), and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, you ("Participant") agree to the following on behalf of yourself, your heirs, executors, administrators, successors, and assigns:',

  sections: [
    {
      number: 1,
      title: 'Acknowledgment of Risks',
      body: [
        'Participant acknowledges and understands that use of the Facility and golf simulator equipment involves physical activity and inherent risks, including but not limited to:',
        '• Physical injury from swinging a golf club, including injury from errant backswings, follow-throughs, or contact with equipment\n• Injury caused by golf balls struck at high velocity, including ricochets from screens, walls, or equipment\n• Slip and fall hazards in and around the hitting area and common areas\n• Equipment malfunction or failure\n• Injury caused by the actions of other participants within the bay\n• Medical events, including cardiac events, arising from physical exertion',
        'Participant further acknowledges that the Facility is unmanned and that no Strikepoint personnel will be present during any session. In the event of injury or emergency, Participant is solely responsible for summoning emergency services by calling 911. The full facility address is posted in each bay and at the facility entrance.',
      ],
    },
    {
      number: 2,
      title: 'Physical Fitness Representation',
      body: [
        'Participant represents and warrants that they are in adequate physical condition to safely participate in golf simulator activities and have not been advised by a licensed medical professional to avoid such activities. Participant assumes sole responsibility for any medical or physical limitations that may affect their safe use of the Facility.',
      ],
    },
    {
      number: 3,
      title: 'Release of Liability for Negligence',
      body: [
        'TO THE FULLEST EXTENT PERMITTED BY CONNECTICUT LAW, PARTICIPANT HEREBY RELEASES, WAIVES, DISCHARGES, AND COVENANTS NOT TO SUE STRIKEPOINT SIMULATORS, LLC, ITS MEMBERS, MANAGERS, OFFICERS, AGENTS, CONTRACTORS, AND ASSIGNS (COLLECTIVELY, "RELEASEES") FROM ANY AND ALL LIABILITY, CLAIMS, DEMANDS, LOSSES, DAMAGES, COSTS, AND CAUSES OF ACTION, INCLUDING CLAIMS ARISING FROM THE ORDINARY NEGLIGENCE OF THE RELEASEES, RELATING TO OR ARISING FROM: (i) PARTICIPANT\'S USE OF THE FACILITY OR SIMULATOR EQUIPMENT; (ii) ANY INJURY TO PARTICIPANT\'S PERSON OR PROPERTY SUSTAINED WHILE ON THE PREMISES; OR (iii) ANY OTHER EVENT OCCURRING IN CONNECTION WITH PARTICIPANT\'S USE OF THE SERVICES.',
        'Participant expressly acknowledges that this Release covers claims arising from the ordinary negligence of Strikepoint and its Releasees. Participant understands and acknowledges that Connecticut law disfavors such releases and that courts may scrutinize this provision under public policy principles articulated in Hanks v. Powder Ridge Restaurant Corp. and related cases. Participant voluntarily and knowingly accepts these terms with full awareness of the applicable legal standards.',
        'Nothing in this Release purports to release any Releasee from liability for gross negligence, reckless conduct, or intentional misconduct.',
      ],
    },
    {
      number: 4,
      title: 'Assumption of Risk',
      body: [
        'Participant voluntarily and knowingly assumes all risks associated with use of the Facility, including but not limited to the risks identified in Section 1 above, whether caused by the condition of the Facility, the actions of other participants, equipment malfunction, or the ordinary negligence of the Releasees. This assumption of risk is made freely and without inducement.',
      ],
    },
    {
      number: 5,
      title: 'Indemnification',
      body: [
        'Participant agrees to defend, indemnify, and hold harmless the Releasees from and against any and all claims, damages, losses, costs, and attorney\'s fees arising out of or resulting from: (i) any act or omission of Participant or Participant\'s guests while using the Facility; (ii) Participant\'s breach of any provision of the Terms of Use and Membership Agreement; or (iii) any claim brought by a third party that was caused, in whole or in part, by the actions of Participant or Participant\'s guests.',
      ],
    },
    {
      number: 6,
      title: 'Waiver Duration and Scope',
      body: [
        'This Waiver and Release of Liability shall remain effective and binding for all future visits to any Strikepoint Simulators, LLC facility for a period of 12 months from the date of signing, unless a shorter period is required by applicable law. Upon expiration, a new waiver must be completed before further access is granted.',
        'This Waiver applies to Participant\'s use of all areas of the Facility, including simulator bays, common areas, corridors, restrooms, and all adjacent property under Strikepoint\'s control.',
      ],
    },
    {
      number: 7,
      title: 'Waiver on Behalf of Minors',
      body: [
        'If Participant is signing this Waiver on behalf of a minor child or ward, Participant represents and warrants that they are the parent or legal guardian of that minor and have the legal authority to execute this document on the minor\'s behalf. Participant accepts all terms of this Waiver on behalf of the minor. Participant acknowledges that the enforceability of a parental waiver on behalf of a minor in Connecticut is not fully settled under applicable law and agrees to this provision voluntarily and with knowledge of that uncertainty.',
      ],
    },
    {
      number: 8,
      title: 'Voluntary Execution',
      body: [
        'Participant acknowledges that they have had the opportunity to read this entire Waiver before signing, that they fully understand its terms and the rights they are surrendering, and that they are signing voluntarily and without duress or coercion. Participant acknowledges that this Waiver was made available for review prior to the date of signing.',
      ],
    },
    {
      number: 9,
      title: 'Severability',
      body: [
        'If any provision of this Waiver is found unenforceable by a court of competent jurisdiction, including under the public policy analysis applicable in Connecticut, the remaining provisions shall continue in full force and effect.',
      ],
    },
    {
      number: 10,
      title: 'Photo and Video Release',
      body: [
        'Participant consents to Strikepoint using photographs or video recorded at the Facility in which Participant appears for marketing and promotional purposes. Participant grants this consent without entitlement to compensation. Participant may opt out at any time by providing written notice to operations@strikepointsims.com prior to their session.',
      ],
    },
  ],
} as const
