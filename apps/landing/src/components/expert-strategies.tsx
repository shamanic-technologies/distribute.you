const EXPERT_CATEGORIES = [
  {
    feature: "Welcome Emails",
    color: {
      bg: "bg-emerald-100",
      text: "text-emerald-600",
      border: "border-emerald-200",
      dot: "bg-emerald-400",
      avatar: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    experts: [
      {
        name: "Ryan Deiss",
        title: "DigitalMarketer",
        initials: "RD",
        strategy: "Indoctrination Sequence — a multi-step welcome flow that turns new subscribers into engaged buyers within 48 hours.",
      },
      {
        name: "Pat Flynn",
        title: "Smart Passive Income",
        initials: "PF",
        strategy: "Value-first onboarding — lead with free wins and quick results before any pitch, building trust through generosity.",
      },
      {
        name: "André Chaperon",
        title: "AutoResponder Madness",
        initials: "AC",
        strategy: "Story-based email sequences — narrative-driven emails that create emotional investment and dramatically increase engagement.",
      },
    ],
  },
  {
    feature: "Cold Outreach",
    color: {
      bg: "bg-cyan-100",
      text: "text-cyan-600",
      border: "border-cyan-200",
      dot: "bg-cyan-400",
      avatar: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    experts: [
      {
        name: "Alex Hormozi",
        title: "$100M Leads",
        initials: "AH",
        strategy: "Volume meets value — high-volume outreach with irresistible offers that make prospects feel stupid saying no.",
      },
      {
        name: "Patrick Dang",
        title: "Sales Psychology",
        initials: "PD",
        strategy: "Consultative cold email — open with genuine curiosity about the prospect's challenges, then position as the natural solution.",
      },
      {
        name: "Kyle Coleman",
        title: "CMO @ Copy.ai",
        initials: "KC",
        strategy: "Hyper-personalized B2B outreach — use signals and intent data to craft emails that feel like they were written just for that person.",
      },
    ],
  },
  {
    feature: "Webinar Lifecycle",
    color: {
      bg: "bg-blue-100",
      text: "text-blue-600",
      border: "border-blue-200",
      dot: "bg-blue-400",
      avatar: "bg-blue-50 text-blue-700 border-blue-200",
    },
    experts: [
      {
        name: "Russell Brunson",
        title: "ClickFunnels",
        initials: "RB",
        strategy: "The Perfect Webinar — a proven framework that generated $14M in its first year through structured storytelling and stack offers.",
      },
      {
        name: "Amy Porterfield",
        title: "Digital Course Academy",
        initials: "AP",
        strategy: "List-to-launch webinars — nurture your audience with value-packed live sessions that naturally convert into course enrollments.",
      },
      {
        name: "Jeff Walker",
        title: "Product Launch Formula",
        initials: "JW",
        strategy: "Sideways sales letter — a multi-day launch sequence that builds anticipation, delivers value, and creates urgency through scarcity.",
      },
    ],
  },
];

export function ExpertStrategies() {
  return (
    <div>
      <div className="text-center mb-14">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Powered by proven expert strategies
        </h2>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
          Our workflows encode the best strategies from industry leaders.
          You get access to world-class playbooks — automatically, at the cost of
          raw AI.
        </p>
      </div>

      <div className="space-y-10">
        {EXPERT_CATEGORIES.map((category) => (
          <div key={category.feature}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${category.color.dot}`} />
              <h3 className="font-display font-semibold text-gray-900">
                {category.feature}
              </h3>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {category.experts.map((expert) => (
                <div
                  key={expert.name}
                  className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border ${category.color.avatar}`}
                    >
                      {expert.initials}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {expert.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {expert.title}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {expert.strategy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-10">
        <p className="text-sm text-gray-400">
          Each strategy is encoded into competing AI workflows.
          The best-performing one runs automatically — or you can choose.
        </p>
      </div>
    </div>
  );
}
