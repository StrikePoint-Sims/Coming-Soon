import type { Metadata } from 'next'
import { PrivacySettingsButton } from '@/components/PrivacySettingsButton'

export const metadata: Metadata = {
  title: 'Privacy Policy | StrikePoint Sims',
  robots: { index: false, follow: false },
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <style>{`
        .pp-topbar { display:flex;align-items:center;justify-content:space-between;padding:24px 40px;background:#0a0a0a;border-bottom:1px solid rgba(255,255,255,0.06); }
        .pp-topbar-logo { height:36px;width:auto;opacity:0.9; }
        .pp-topbar-home { font-size:0.82rem;color:rgba(255,255,255,0.6);text-decoration:none;letter-spacing:0.03em;transition:color 0.25s; }
        .pp-topbar-home:hover { color:#fff; }
        .pp-wrap { max-width:720px;margin:0 auto;padding:64px 40px 96px;font-family:'Hanken Grotesk',system-ui,sans-serif; }
        .pp-eyebrow { font-size:0.72rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#8fa65e;display:block;margin-bottom:16px; }
        .pp-title { font-family:'Playfair Display',Georgia,serif;font-size:clamp(1.6rem,4vw,2.4rem);font-weight:400;line-height:1.2;margin-bottom:10px; }
        .pp-meta { font-size:0.82rem;color:rgba(255,255,255,0.6);margin-bottom:48px; }
        .pp-section { margin-bottom:36px;padding-bottom:36px;border-bottom:1px solid rgba(255,255,255,0.08); }
        .pp-section:last-child { border-bottom:none; }
        .pp-section h2 { font-family:'Playfair Display',Georgia,serif;font-size:1.05rem;font-weight:400;color:#fff;margin-bottom:12px; }
        .pp-section h3 { font-size:0.92rem;font-weight:700;color:rgba(255,255,255,0.88);margin:16px 0 8px; }
        .pp-section p { font-size:0.92rem;color:rgba(255,255,255,0.88);line-height:1.8;margin-bottom:10px; }
        .pp-section p:last-child { margin-bottom:0; }
        .pp-section ul { padding-left:18px;margin:8px 0; }
        .pp-section li { font-size:0.92rem;color:rgba(255,255,255,0.88);line-height:1.8; }
        .pp-section a { color:#8fa65e;text-underline-offset:2px; }
        .pp-footer { padding:28px 40px;background:#d6d1c4;color:#1a1a1a;font-size:0.82rem;text-align:center; }
        .pp-footer a { color:#1a1a1a;text-decoration:none;margin:0 12px; }
        .pp-footer a:hover { opacity:0.6; }
        @media(max-width:600px){.pp-topbar{padding:18px 20px}.pp-wrap{padding:48px 20px 72px}.pp-footer{padding:20px}}
      `}</style>

      <div className="pp-topbar">
        <a href="/"><img src="/logohorizontal.png" alt="StrikePoint Sims" className="pp-topbar-logo" loading="eager" /></a>
        <a href="/" className="pp-topbar-home">← Home</a>
      </div>

      <div className="pp-wrap">
        <span className="pp-eyebrow">Legal</span>
        <h1 className="pp-title">Privacy Policy</h1>
        <p className="pp-meta">Strikepoint Simulators, LLC · Last Updated: April 28, 2026</p>

        <div className="pp-section">
          <h2>1. Introduction</h2>
          <p>Strikepoint Simulators, LLC ("Strikepoint," "we," "us," or "our") operates an autonomous indoor golf simulator facility and website at https://strikepointsims.com (the "Services"). The facility operates without on-site staff. Access is granted via a cloud-based keyless entry system, and customer support is provided through an AI-assisted platform. This Privacy Policy explains how we collect, use, disclose, and process personal data in compliance with the Connecticut Data Privacy Act (CTDPA) and other applicable law.</p>
        </div>

        <div className="pp-section">
          <h2>2. Scope</h2>
          <p>This policy applies to personal data collected through our website, waitlist and contact forms, membership enrollment, reservations, facility access, video surveillance, AI-assisted customer support, and all other interactions with our Services.</p>
        </div>

        <div className="pp-section">
          <h2>3. Personal Data We Collect</h2>
          <h3>3a. Data You Provide Directly</h3>
          <ul>
            <li>Name, email address, phone number, and town or general location</li>
            <li>Membership tier, reservation history, and account credentials</li>
            <li>Waiver acknowledgment, including assumption of risk, liability release, consent to video recording, and photo/video release for marketing purposes</li>
            <li>Communications submitted through our AI-assisted support platform, waitlist form, or email</li>
          </ul>
          <h3>3b. Facility Access Data</h3>
          <p>Access to the facility is managed through OpenPath, a cloud-based keyless entry system. OpenPath logs entry and exit events tied to individual access credentials. We retain access logs for 12 months, after which records are deleted. OpenPath may retain data on its own servers in accordance with its own privacy policy, available at <a href="https://www.openpath.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">openpath.com/legal/privacy-policy</a>.</p>
          <h3>3c. Video Surveillance</h3>
          <p>The facility is monitored by security cameras covering the entrance, movement areas, and simulator bays. Non-incident footage is retained for 30 days and then overwritten. Footage associated with a documented incident is archived indefinitely for insurance, legal, and law enforcement purposes. Footage is not shared with third parties except as required by law or in connection with an incident under investigation.</p>
          <h3>3d. Trackman Session and Performance Data</h3>
          <p>Our simulator bays operate on the Trackman iO platform. When customers use the simulators, Trackman may collect session data, shot data, performance analytics, and account information through its platform. Trackman acts as an independent data controller for data it collects directly. Their privacy policy is available at <a href="https://www.trackman.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">trackman.com/legal/privacy-policy</a>. Trackman retains customer data for the duration of the account relationship and for 24 months following account termination.</p>
          <p>With respect to data we hold independently: we retain session records for the duration of the customer relationship. Upon a verified deletion request, we will remove personal data from our systems within 30 days.</p>
          <h3>3e. AI-Assisted Customer Support</h3>
          <p>Customer inquiries submitted through our chat support interface are processed using Claude, an AI platform operated by Anthropic, PBC. We retain conversation logs for 90 days. Anthropic&apos;s handling of data is governed by their privacy policy at <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">anthropic.com/legal/privacy</a>.</p>
          <h3>3f. Payment Data</h3>
          <p>Payment processing is handled by Stripe, Inc. We do not store full credit card numbers, CVV codes, or bank account information. Stripe&apos;s privacy policy is at <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>.</p>
          <h3>3g. Automatically Collected Data</h3>
          <ul>
            <li>IP address, browser type, device type, and operating system</li>
            <li>Website usage data, including pages visited, time on page, and referral source</li>
            <li>Cookie and tracking technology data (see Section 10)</li>
          </ul>
        </div>

        <div className="pp-section">
          <h2>4. How We Use Personal Data</h2>
          <ul>
            <li>Granting and managing facility access</li>
            <li>Processing reservations and membership accounts</li>
            <li>Processing payments through Stripe</li>
            <li>Responding to customer inquiries via AI-assisted chat</li>
            <li>Sending transactional communications including booking confirmations, access credentials, and account notices</li>
            <li>Sending marketing communications where consent has been provided</li>
            <li>Running targeted advertising through Meta (Facebook/Instagram) and Google</li>
            <li>Monitoring facility safety and security through video surveillance</li>
            <li>Maintaining and improving our Services</li>
            <li>Complying with applicable law and defending legal claims</li>
          </ul>
          <p>We do not use personal data to train AI systems, and we do not sell personal data for monetary consideration. Certain disclosures to advertising platforms (Meta, Google) may qualify as a "sale" or "sharing" under Connecticut law. See Section 6 for opt-out rights.</p>
        </div>

        <div className="pp-section">
          <h2>5. Sharing of Personal Data</h2>
          <p>We may share personal data with:</p>
          <ul>
            <li>Service providers acting on our behalf, including Stripe, OpenPath, Trackman, and Anthropic</li>
            <li>Advertising platforms, including Meta and Google, for targeted advertising and lookalike audiences</li>
            <li>Law enforcement or government authorities when required by applicable law or court order</li>
            <li>Successor entities in connection with a merger, acquisition, or sale of substantially all business assets</li>
          </ul>
          <p>We do not share personal data with third parties for their own independent marketing purposes. Mobile opt-in data and SMS consent are never shared with any third party for any purpose.</p>
        </div>

        <div className="pp-section">
          <h2>6. Connecticut Privacy Rights (CTDPA)</h2>
          <p>Connecticut residents have the following rights under the Connecticut Data Privacy Act:</p>
          <ul>
            <li>Right to confirm whether we process your personal data and to access that data</li>
            <li>Right to correct inaccuracies in your personal data</li>
            <li>Right to delete personal data you have provided or that we have collected about you</li>
            <li>Right to obtain a portable copy of your personal data in a machine-readable format</li>
            <li>Right to opt out of targeted advertising, the sale of personal data, and profiling</li>
          </ul>
          <p>To exercise any of these rights, submit a request to <a href="mailto:operations@strikepointsims.com">operations@strikepointsims.com</a> with the subject line "Privacy Rights Request." We will respond within 45 days. We will not discriminate against you for exercising these rights.</p>
        </div>

        <div className="pp-section">
          <h2>7. Appeals</h2>
          <p>If we decline to act on a privacy rights request, you may appeal by emailing <a href="mailto:operations@strikepointsims.com">operations@strikepointsims.com</a> with the subject line "Privacy Appeal." We will respond within 60 days. If your appeal is denied, you may submit a complaint to the Connecticut Attorney General at <a href="https://portal.ct.gov/AG" target="_blank" rel="noopener noreferrer">portal.ct.gov/AG</a>.</p>
        </div>

        <div className="pp-section">
          <h2>8. Data Breach Notification</h2>
          <p>In the event of a data breach, we will notify affected Connecticut residents and the Connecticut Attorney General in accordance with the Connecticut Data Breach Notification Law (Conn. Gen. Stat. § 36a-701b), no later than 60 days following discovery of the breach.</p>
        </div>

        <div className="pp-section">
          <h2>9. Minors</h2>
          <p>Our Services are not directed at individuals under the age of 18 as independent account holders. Minors may use the facility when accompanied by a parent or legal guardian who has completed the required waiver. We do not knowingly collect personal data directly from minors.</p>
        </div>

        <div className="pp-section">
          <h2>10. Cookies and Tracking Technologies</h2>
          <p>Our website uses cookies and similar tracking technologies, including Google Analytics and Meta Pixel. These tools collect data about website activity to support advertising, analytics, and service improvement. You may manage cookie preferences using the <PrivacySettingsButton /> on this site. Opting out of cookies may affect the functionality of certain website features.</p>
          <p>Meta Pixel is used to measure advertising effectiveness and build custom audiences. To opt out of Meta&apos;s use of your data, visit <a href="https://www.facebook.com/settings/?tab=ads" target="_blank" rel="noopener noreferrer">facebook.com/settings/?tab=ads</a> or the Digital Advertising Alliance opt-out tool at <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer">optout.aboutads.info</a>.</p>
        </div>

        <div className="pp-section">
          <h2>11. Opt-Out of Targeted Advertising</h2>
          <p>To opt out of targeted advertising or the sharing of your data with advertising platforms, you may:</p>
          <ul>
            <li>Email <a href="mailto:operations@strikepointsims.com">operations@strikepointsims.com</a> with the subject line "Opt-Out Request"</li>
            <li>Use ad preference settings on <a href="https://www.facebook.com/settings/?tab=ads" target="_blank" rel="noopener noreferrer">Meta</a> or <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google</a></li>
            <li>Use the Digital Advertising Alliance opt-out tool at <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer">optout.aboutads.info</a></li>
          </ul>
        </div>

        <div className="pp-section">
          <h2>12. Sensitive Personal Data</h2>
          <p>We do not intentionally collect sensitive personal data as defined under the CTDPA. If we determine that sensitive data has been inadvertently collected, we will obtain opt-in consent before processing it, or delete it.</p>
        </div>

        <div className="pp-section">
          <h2>13. Data Retention</h2>
          <ul>
            <li>Active customer account data: retained for the duration of the membership or account relationship</li>
            <li>Session records (independently held): retained unless a deletion request is received; deleted within 30 days of a verified request</li>
            <li>AI support conversation logs: 90 days</li>
            <li>Facility access logs (OpenPath): 12 months</li>
            <li>Non-incident surveillance footage: 30 days (rolling)</li>
            <li>Incident-related surveillance footage: retained indefinitely</li>
            <li>Waiver records: minimum 7 years</li>
            <li>Transaction and payment records: as required by applicable tax and accounting obligations</li>
          </ul>
        </div>

        <div className="pp-section">
          <h2>14. Security</h2>
          <p>We implement reasonable administrative, technical, and physical safeguards to protect personal data. Payment data is handled exclusively by Stripe and is not stored on our systems. No data transmission or storage system is guaranteed to be completely secure.</p>
        </div>

        <div className="pp-section">
          <h2>15. Updates to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Material changes will be communicated by posting the revised policy on our website with an updated effective date. Continued use of the Services following the posting of changes constitutes acceptance of the revised policy.</p>
        </div>

        <div className="pp-section">
          <h2>16. Contact</h2>
          <p>For privacy-related inquiries, rights requests, or appeals:</p>
          <p>Strikepoint Simulators, LLC<br />
          Email: <a href="mailto:operations@strikepointsims.com">operations@strikepointsims.com</a></p>
        </div>
      </div>

      <footer className="pp-footer">
        <a href="/">Home</a>
        <a href="/join">Reserve a Spot</a>
        <a href="/terms">Terms of Use</a>
        <span style={{ display: 'block', marginTop: 10, opacity: 0.5 }}>
          © 2026 StrikePoint Sims · Colchester, Connecticut · <PrivacySettingsButton />
        </span>
      </footer>
    </>
  )
}
