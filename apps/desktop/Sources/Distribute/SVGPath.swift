import SwiftUI

/// Draws dashboard v2's own icon paths (`v2-shell.tsx` ICONS, `sidebar-menus.tsx`
/// MENU_ICON), so the sidebar's glyphs are the web's, not look-alikes.
/// Supports M L H V C S Q A Z (absolute and relative), the subset those icons use.
struct SVGIcon: View {
    let d: String
    var viewBox: CGFloat = 16
    var size: CGFloat = 16
    var lineWidth: CGFloat = 1.3
    var color: Color = K.fg3
    var body: some View {
        SVGShape(d: d, viewBox: viewBox)
            .stroke(color, style: StrokeStyle(lineWidth: lineWidth * size / viewBox, lineCap: .round, lineJoin: .round))
            .frame(width: size, height: size)
    }
}

struct SVGShape: Shape {
    let d: String
    var viewBox: CGFloat = 16
    func path(in rect: CGRect) -> Path {
        let p = SVGPathParser.parse(d)
        let s = min(rect.width, rect.height) / viewBox
        return p.applying(CGAffineTransform(scaleX: s, y: s).translatedBy(x: rect.minX / s, y: rect.minY / s))
    }
}

enum SVGPathParser {
    private enum Tok { case cmd(Character), num(CGFloat) }

    private static func tokenize(_ d: String) -> [Tok] {
        var out: [Tok] = []
        let chars = Array(d)
        var i = 0
        while i < chars.count {
            let c = chars[i]
            if c.isLetter && c != "e" && c != "E" { out.append(.cmd(c)); i += 1; continue }
            if c == "-" || c == "+" || c == "." || c.isNumber {
                var j = i
                var s = ""
                if chars[j] == "-" || chars[j] == "+" { s.append(chars[j]); j += 1 }
                var dot = false
                while j < chars.count {
                    let ch = chars[j]
                    if ch.isNumber { s.append(ch); j += 1 }
                    else if ch == "." && !dot { dot = true; s.append(ch); j += 1 }
                    else if (ch == "e" || ch == "E") && j + 1 < chars.count { s.append(ch); j += 1; if chars[j] == "-" || chars[j] == "+" { s.append(chars[j]); j += 1 } }
                    else { break }
                }
                out.append(.num(CGFloat(Double(s) ?? 0)))
                i = j
                continue
            }
            i += 1
        }
        return out
    }

    static func parse(_ d: String) -> Path {
        var path = Path()
        let toks = tokenize(d)
        var i = 0
        var cmd: Character = "M"
        var cur = CGPoint.zero, start = CGPoint.zero, lastCtrl: CGPoint? = nil
        func n() -> CGFloat { if case .num(let v) = toks[i] { i += 1; return v }; i += 1; return 0 }
        while i < toks.count {
            if case .cmd(let c) = toks[i] { cmd = c; i += 1 }
            let rel = cmd.isLowercase
            let base = rel ? cur : .zero
            switch cmd.uppercased().first! {
            case "M":
                let p = CGPoint(x: base.x + n(), y: base.y + n())
                path.move(to: p); cur = p; start = p; lastCtrl = nil
                cmd = rel ? "l" : "L"
            case "L":
                let p = CGPoint(x: base.x + n(), y: base.y + n()); path.addLine(to: p); cur = p; lastCtrl = nil
            case "H":
                let x = (rel ? cur.x : 0) + n(); cur = CGPoint(x: x, y: cur.y); path.addLine(to: cur); lastCtrl = nil
            case "V":
                let y = (rel ? cur.y : 0) + n(); cur = CGPoint(x: cur.x, y: y); path.addLine(to: cur); lastCtrl = nil
            case "C":
                let c1 = CGPoint(x: base.x + n(), y: base.y + n()), c2 = CGPoint(x: base.x + n(), y: base.y + n()), p = CGPoint(x: base.x + n(), y: base.y + n())
                path.addCurve(to: p, control1: c1, control2: c2); lastCtrl = c2; cur = p
            case "S":
                let c1 = lastCtrl.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                let c2 = CGPoint(x: base.x + n(), y: base.y + n()), p = CGPoint(x: base.x + n(), y: base.y + n())
                path.addCurve(to: p, control1: c1, control2: c2); lastCtrl = c2; cur = p
            case "Q":
                let c = CGPoint(x: base.x + n(), y: base.y + n()), p = CGPoint(x: base.x + n(), y: base.y + n())
                path.addQuadCurve(to: p, control: c); lastCtrl = nil; cur = p
            case "A":
                let rx = n(), ry = n(), rot = n(), large = n() != 0, sweep = n() != 0
                let p = CGPoint(x: base.x + n(), y: base.y + n())
                addArc(&path, from: cur, to: p, rx: rx, ry: ry, rotation: rot, large: large, sweep: sweep)
                cur = p; lastCtrl = nil
            case "Z":
                path.closeSubpath(); cur = start; lastCtrl = nil
                continue
            default:
                i += 1
            }
        }
        return path
    }

    /// SVG endpoint arc → cubic Béziers (≤ 90° each).
    private static func addArc(_ path: inout Path, from p0: CGPoint, to p1: CGPoint, rx rx0: CGFloat, ry ry0: CGFloat,
                               rotation: CGFloat, large: Bool, sweep: Bool) {
        var rx = abs(rx0), ry = abs(ry0)
        if rx == 0 || ry == 0 || p0 == p1 { path.addLine(to: p1); return }
        let phi = rotation * .pi / 180, cosP = cos(phi), sinP = sin(phi)
        let dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2
        let x1 = cosP * dx + sinP * dy, y1 = -sinP * dx + cosP * dy
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 { rx *= sqrt(lambda); ry *= sqrt(lambda) }
        var num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        if num < 0 { num = 0 }
        var coef = sqrt(num / (rx * rx * y1 * y1 + ry * ry * x1 * x1))
        if large == sweep { coef = -coef }
        let cx1 = coef * rx * y1 / ry, cy1 = -coef * ry * x1 / rx
        let cx = cosP * cx1 - sinP * cy1 + (p0.x + p1.x) / 2
        let cy = sinP * cx1 + cosP * cy1 + (p0.y + p1.y) / 2
        func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a
        }
        let theta1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
        var dTheta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
        if !sweep && dTheta > 0 { dTheta -= 2 * .pi }
        if sweep && dTheta < 0 { dTheta += 2 * .pi }
        let segs = max(1, Int(ceil(abs(dTheta) / (.pi / 2))))
        let delta = dTheta / CGFloat(segs)
        let t = 4 / 3 * tan(delta / 4)
        var th = theta1
        for _ in 0..<segs {
            let c1 = CGPoint(x: cos(th) - t * sin(th), y: sin(th) + t * cos(th))
            let th2 = th + delta
            let e = CGPoint(x: cos(th2), y: sin(th2))
            let c2 = CGPoint(x: e.x + t * sin(th2), y: e.y - t * cos(th2))
            func map(_ q: CGPoint) -> CGPoint {
                CGPoint(x: cx + rx * q.x * cosP - ry * q.y * sinP, y: cy + rx * q.x * sinP + ry * q.y * cosP)
            }
            path.addCurve(to: map(e), control1: map(c1), control2: map(c2))
            th = th2
        }
    }
}

/// dashboard v2's icon paths, byte-equal to the web (16-unit viewBox).
enum V2Icon {
    static let today = "M2.5 12.5h11M4 12.5V9m3 3.5V6.5m3 6V8m3 4.5v-6M8 2.5l.7 1.4 1.5.2-1.1 1 .3 1.5L8 5.9l-1.4.7.3-1.5-1.1-1 1.5-.2Z"
    static let records = "M2.5 3.5h11v9h-11zM2.5 6.5h11M6 6.5v6"
    static let channels = "M2.5 4.5h11v7h-11zM2.5 4.5 8 8.5l5.5-4"
    static let offer = "M8.5 2.5h5v5L7.5 13.5l-5-5Zm2.5 2.5h.01"
    static let target = "M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm0-3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
    static let plug = "M6 2.5v3m4-3v3M4.5 5.5h7v2a3.5 3.5 0 0 1-7 0zM8 11v2.5"
    static let settings = "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.2-1.1.9.6-1 1.8-1.1-.3a4.5 4.5 0 0 1-1.3.8l-.2 1.2H7.5l-.2-1.2a4.5 4.5 0 0 1-1.3-.8l-1.1.3-1-1.8.9-.6a4.5 4.5 0 0 1 0-1.8l-.9-.6 1-1.8 1.1.3c.4-.3.8-.6 1.3-.8l.2-1.2h2l.2 1.2c.5.2.9.5 1.3.8l1.1-.3 1 1.8-.9.6a4.5 4.5 0 0 1 0 1.8Z"
    static let team = "M6 7.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm-4 5.5c.4-2 2-3.2 4-3.2s3.6 1.2 4 3.2M10.5 3.2a2.2 2.2 0 0 1 0 4.1M12 9.9c1.2.4 2 1.4 2.2 3.1"
    static let key = "M6 9.5a3 3 0 1 1 2.6-1.5l4.9 4.9-1.2 1.2-1-1-1 1-1-1 1-1-2.1-2.1A3 3 0 0 1 6 9.5Z"
    static let billing = "M3.5 2.5h9v11l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1zM6 5.5h4M6 8h4"
    static let gift = "M2.5 6h11v2.5h-11zM3.5 8.5v5h9v-5M8 6v7.5M8 6c-1-2.5-4-2.5-4-.8C4 6 6 6 8 6Zm0 0c1-2.5 4-2.5 4-.8C12 6 10 6 8 6Z"
    static let help = "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.4.2-.7.5-.7 1v.5M8 11.3v.2"
    static let out = "M9.5 3.5h3v9h-3M6.5 5 3.5 8l3 3M3.5 8h7"
    static let search = "M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm6.5 1.5-3-3"
    /// 14-unit viewBox in the web.
    static let plus = "M7 2.5v9M2.5 7h9"
    /// 12-unit viewBox in the web.
    static let updown = "M4 4.5 6 2.5l2 2M4 7.5l2 2 2-2"
    static let chevron = "M3 4.5 6 7.5l3-3"
}
