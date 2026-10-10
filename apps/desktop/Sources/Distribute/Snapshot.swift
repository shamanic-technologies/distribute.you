import SwiftUI
import AppKit

/// `Distribute --snapshot <dir>` renders the main window over FIXTURE data (no network,
/// no account) into PNGs, one per panel, then exits. CI uploads them so a change to the
/// look can be reviewed without running the app (`.github/workflows/desktop.yml`).
/// The figures are placeholders for layout review only; nothing here ships to a user.
@MainActor
enum Snapshot {
    static func runIfAsked() {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "--snapshot"), i + 1 < args.count else { return }
        let dir = URL(fileURLWithPath: args[i + 1], isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        for pane in Pane.snapshotCases {
            let state = fixtureState(pane: pane)
            let view = RootView().environmentObject(state).environment(\.isSnapshot, true).frame(width: 1320, height: 820)
            let renderer = ImageRenderer(content: view)
            renderer.scale = 2
            guard let image = renderer.nsImage,
                  let tiff = image.tiffRepresentation,
                  let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) else {
                FileHandle.standardError.write(Data("[desktop] snapshot \(pane.slug) failed\n".utf8))
                exit(1)
            }
            try? png.write(to: dir.appendingPathComponent("\(pane.slug).png"))
        }
        // The sidebar's two popovers, open, for side-by-side review with the web.
        for (name, menu) in [("menu-tenant", SidebarMenu.tenant), ("menu-account", .account)] {
            let state = fixtureState(pane: .today)
            state.menu = menu
            let renderer = ImageRenderer(content: RootView().environmentObject(state).environment(\.isSnapshot, true).frame(width: 1320, height: 820))
            renderer.scale = 2
            if let tiff = renderer.nsImage?.tiffRepresentation, let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) {
                try? png.write(to: dir.appendingPathComponent("\(name).png"))
            }
        }
        exit(0)
    }

    private static func decode<T: Decodable>(_ json: String) -> T {
        try! JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    private static func fixtureState(pane: Pane) -> AppState {
        let s = AppState()
        s.apiKey = "fixture"
        s.cliChecked = true
        s.cli = ClaudeCLI.Located(binary: "/usr/bin/true", path: "")
        let me: Me = decode(#"{"user":{"email":"you@example.com","firstName":"Sam"},"organizations":[{"id":"o1","name":"Example Org","brands":[{"id":"b1","name":"Example Brand","domain":"example.com"}]}],"lookupErrors":[]}"#)
        s.me = me
        s.selectedOrg = me.organizations?.first
        s.selectedBrand = me.organizations?.first?.brands.first
        s.offers = [Offer(offerId: "f1", name: "Done-for-you audit")]
        s.selectedOffer = s.offers.first
        s.offerHasCampaign = true
        s.counts = SidebarCounts(needsCall: 3, companies: 42, people: 1280, deals: 57)
        s.balance = decode(#"{"balance_cents":"12850.00","depleted":false}"#)
        s.pane = pane
        let leads: LeadPage = decode(#"{"total":3,"leads":[{"id":"l1","email":"ana@acme.test","status":"served","contacted":true,"sent":true,"delivered":true,"clicked":true,"bounced":false,"unsubscribed":false,"replied":true,"firstRepliedAt":"2026-10-03T10:00:00Z","lead":{"firstName":"Ana","lastName":"Lopez","currentTitle":"Head of Growth","organization":{"name":"Acme"}}},{"id":"l2","email":"ben@globex.test","status":"served","contacted":true,"sent":true,"delivered":true,"clicked":false,"bounced":false,"unsubscribed":false,"replied":true,"firstRepliedAt":"2026-10-02T09:00:00Z","lead":{"firstName":"Ben","lastName":"Kim","currentTitle":"CEO","organization":{"name":"Globex"}}},{"id":"l3","email":"cy@initech.test","status":"served","contacted":true,"sent":true,"delivered":true,"clicked":true,"bounced":false,"unsubscribed":false,"replied":false,"firstClickedAt":"2026-10-01T09:00:00Z","lead":{"firstName":"Cy","lastName":"Ng","headline":"Founder","organization":{"name":"Initech"}}}]}"#)
        let revenue: OfferRevenue = decode(#"{"headline":{"totalPipelineUsd":48200},"costEconomics":{"maturity":{"isMature":false,"flash":{"roiMultiple":2.4}}},"organizations":[{"orgName":"Acme","orgDomain":"acme.test","tags":["reply","visit"],"expectedRevenueUsd":12000},{"orgName":"Globex","orgDomain":"globex.test","tags":["visit"],"expectedRevenueUsd":8000},{"orgName":"Initech","orgDomain":"initech.test","tags":["delivered"],"expectedRevenueUsd":2500}]}"#)
        let window: RevenueWindow = decode(#"{"window":{"emails":{"sent":1240,"delivered":1190,"bounced":50,"deliveryRatePct":96},"spend":{"totalSpentCents":21400,"daily":[{"totalSpentCents":2800},{"totalSpentCents":3100},{"totalSpentCents":3000},{"totalSpentCents":3200},{"totalSpentCents":2900},{"totalSpentCents":3300},{"totalSpentCents":3100}]},"recipientsRepliesPositive":{"total":9,"daily":[{"count":0},{"count":1},{"count":1},{"count":2},{"count":1},{"count":3},{"count":1}]},"recipientsClicked":{"total":38,"daily":[{"count":3},{"count":5},{"count":4},{"count":7},{"count":6},{"count":8},{"count":5}]},"expectedPipeline":{"daily":[{"cumulativePipelineUsd":30000},{"cumulativePipelineUsd":33000},{"cumulativePipelineUsd":36000},{"cumulativePipelineUsd":40000},{"cumulativePipelineUsd":43000},{"cumulativePipelineUsd":46000},{"cumulativePipelineUsd":48200}]}}}"#)
        s.today = .loaded(TodayData(revenue: revenue, window: window, needsCall: leads))
        s.companies = .loaded(revenue)
        s.people = .loaded(leads)
        s.deals = .loaded(DealsData(standing: decode(#"{"counts":{"unresolved":0,"contacted":40,"engaged":8,"sales_interest":6,"customer":3,"opted_out":4,"disqualified":2}}"#), pipelineUsd: 48200))
        s.offerData = .loaded(OfferData(lifetimeRevenueUsd: 4000, fields: ["services": ["Audit", "Roadmap"], "dreamOutcome": ["Twice the pipeline in 90 days"]]))
        s.audiences = .loaded((decode(#"{"audiences":[{"id":"a1","name":"Founders in Paris","status":"active","nlPrompt":"Founders and CEOs of 10-50 person software companies in Paris","sizeCount":"1800","availableToContactPct":62},{"id":"a2","name":"Agencies in London","status":"paused","sizeCount":950,"availableToContactPct":30}]}"#) as AudienceList).audiences)
        let funnels: [FunnelCampaign] = (decode(#"{"salesFunnelCampaigns":[{"id":"c1","brandId":"b1","offerId":"f1","salesFunnelId":"lead_found_to_conversation@sales-cold-email-outreach","salesFunnelName":"Soar","status":"ongoing","units":[{"campaignId":"u1","featureSlug":"sales-cold-email-outreach","legKey":"lead_found_to_conversation"},{"campaignId":"u2","featureSlug":"sourcing-apollo-cold-filters","legKey":"start_to_lead_found"}]},{"id":"c2","brandId":"b1","offerId":"f1","salesFunnelId":"lead_found_to_website_visit@sales-cold-email-outreach","salesFunnelName":"Nova","status":"stopped","units":[{"campaignId":"u3","featureSlug":"sales-cold-email-outreach","legKey":"lead_found_to_website_visit"}]}]}"#) as FunnelCampaignList).salesFunnelCampaigns
        let catalogue: PublicCatalogue = decode(#"{"steps":[{"key":"conversation","label":"Positive reply"},{"key":"website_visit","label":"Website visit"},{"key":"lead_found","label":"Lead found"}],"channels":[{"slug":"sales-cold-email-outreach","name":"Sales Cold Email Outreach","stepTransitions":[{"legKey":"lead_found_to_conversation","from":{"key":"lead_found","label":"Lead found"},"to":{"key":"conversation","label":"Positive reply"}},{"legKey":"lead_found_to_website_visit","from":{"key":"lead_found","label":"Lead found"},"to":{"key":"website_visit","label":"Website visit"}}]},{"slug":"sourcing-apollo-cold-filters","name":"Apollo Cold Filters","stepTransitions":[{"legKey":"start_to_lead_found","from":null,"to":{"key":"lead_found","label":"Lead found"}}]}]}"#)
        s.legCatalogue = LegCatalogue(catalogue)
        let joined = joinOnCampaigns(funnels: funnels, offerId: "f1", catalogue: LegCatalogue(catalogue))
        s.onCampaigns = joined.campaigns
        s.outcomes = joined.outcomes
        s.offerCampaigns = .loaded(funnels)
        s.campaignCaps = [
            "c1": decode(#"{"salesFunnelType":"proactive","maxBudget":{"amountCents":"5000","period":"daily","consumedCents":"1240","reached":false},"maxVolume":{"count":200,"period":"monthly","unit":"first_contacts","consumed":80,"reached":false}}"#),
            "c2": decode(#"{"salesFunnelType":"proactive","maxBudget":null,"maxVolume":null}"#),
        ]
        s.bucketCounts = (decode(#"{"counts":{"contacted":1280,"website_visit":38,"positive_reply":9,"signup":0,"meeting_booked":2,"meeting_attended":1,"sale":0}}"#) as BucketCounts).counts
        s.campaignFigures = .loaded(["u1": decode(#"{"campaignId":"u1","costEconomics":{"committedCostUsd":214},"outcomes":{"recipientsRepliesPositive":9,"recipientsClicked":38,"cpprCents":2378,"sending":{"recipientsSent":1240,"replyRatePct":2.1}}}"#) as RevenueGroup])
        s.outcomePeople = .loaded(leads)
        s.unibox = .loaded(decode(#"{"total":2,"people":[{"personKey":"email:ana@acme.test","personId":"0b6f1c9e-1d2a-4c8e-9f00-aa11bb22cc33","displayName":"Ana Lopez","company":"Acme","emails":["ana@acme.test"],"sources":["instantly","gmail"],"lastActivityAt":"2026-10-03T10:00:00Z","state":"sales_interest"},{"personKey":"email:ben@globex.test","displayName":"Ben Kim","company":"Globex","emails":["ben@globex.test"],"sources":["instantly"],"lastActivityAt":"2026-10-02T09:00:00Z","state":"contacted"}]}"#))
        s.chat = [
            .user(id: UUID(), text: "How is it going?"),
            .tool(id: UUID(), label: "Used distribute_campaign_stats"),
            .assistant(id: UUID(), text: "9 positive replies since you started, 3 still waiting on you.\n\n- **Acme**: Ana replied and visited the site twice.\n- **Globex**: Ben asked for pricing.\n\nThe London audience brings no reply yet. Pause it?\nACTION: Pause the audience \"Agencies in London\""),
        ]
        return s
    }
}
