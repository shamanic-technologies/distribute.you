import Foundation
import UserNotifications
import AppKit

/// Proactive half of the app: while it runs, it watches "needs your call" (people who
/// replied with interest and are not closed, dashboard v2's same read) and posts a macOS
/// notification for each new one. Clicking it opens that person.
@MainActor
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()
    weak var state: AppState?
    private var timer: Timer?
    private var known: [String: LeadRow] = [:]

    func start(state: AppState) {
        self.state = state
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error { NSLog("[desktop] notifications refused: \(error.localizedDescription)") }
            if !granted { NSLog("[desktop] notifications not allowed by the user") }
        }
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 90, repeats: true) { _ in
            Task { @MainActor in await Notifier.shared.check() }
        }
        Task { await check() }
    }

    func check() async {
        guard let state, let api = state.api, let brand = state.selectedBrand, let offer = state.selectedOffer else { return }
        let page: LeadPage
        do {
            page = try await api.leads(brandId: brand.id, offerId: offer.offerId,
                                       extra: ["bucket": "positive_reply", "standing": "sales_interest", "limit": "20"])
        } catch {
            NSLog("[desktop] needs-your-call poll failed: \(error.localizedDescription)")
            return
        }
        let key = "notified-\(brand.id)-\(offer.offerId)"
        let seen = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
        let firstRun = UserDefaults.standard.object(forKey: key) == nil
        for lead in page.leads {
            known[lead.id] = lead
            if !firstRun && !seen.contains(lead.id) { post(lead, brand: brand.label) }
        }
        // First run only remembers who is already there: no burst of old replies.
        UserDefaults.standard.set(Array(seen.union(page.leads.map(\.id))), forKey: key)
        state.counts.needsCall = page.total
    }

    private func post(_ lead: LeadRow, brand: String) {
        let c = UNMutableNotificationContent()
        c.title = "\(personName(lead)) replied with interest"
        c.body = [lead.lead?.organization?.name, brand].compactMap { $0 }.joined(separator: " · ")
        c.sound = .default
        c.userInfo = ["leadId": lead.id]
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: lead.id, content: c, trigger: nil))
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                            withCompletionHandler completionHandler: @escaping () -> Void) {
        let id = response.notification.request.content.userInfo["leadId"] as? String
        Task { @MainActor in
            NSApp.activate(ignoringOtherApps: true)
            if let id, let lead = self.known[id], let state = self.state {
                if state.pane != .today { state.open(.today) }
                state.openPerson(lead)
            }
            completionHandler()
        }
    }
}
