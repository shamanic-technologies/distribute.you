import Image from "next/image";

const EXPERT_CATEGORIES = [
  {
    feature: "Welcome Emails",
    color: {
      dot: "bg-emerald-400",
    },
    experts: [
      {
        name: "Ryan Deiss",
        title: "DigitalMarketer",
        photo: "/experts/ryan-deiss.jpg",
        strategy: "Indoctrination Sequence — a multi-step welcome flow that turns new subscribers into engaged buyers within 48 hours.",
      },
      {
        name: "Pat Flynn",
        title: "Smart Passive Income",
        photo: "/experts/pat-flynn.jpg",
        strategy: "Value-first onboarding — lead with free wins and quick results before any pitch, building trust through generosity.",
      },
      {
        name: "André Chaperon",
        title: "AutoResponder Madness",
        photo: "/experts/andre-chaperon.jpg",
        strategy: "Story-based email sequences — narrative-driven emails that create emotional investment and dramatically increase engagement.",
      },
    ],
  },
  {
    feature: "Cold Outreach",
    color: {
      dot: "bg-cyan-400",
    },
    experts: [
      {
        name: "Alex Hormozi",
        title: "$100M Leads",
        photo: "/experts/alex-hormozi.jpg",
        strategy: "Volume meets value — high-volume outreach with irresistible offers that make prospects feel stupid saying no.",
      },
      {
        name: "Patrick Dang",
        title: "Sales Psychology",
        photo: "/experts/patrick-dang.jpg",
        strategy: "Consultative cold email — open with genuine curiosity about the prospect's challenges, then position as the natural solution.",
      },
      {
        name: "Kyle Coleman",
        title: "CMO @ Copy.ai",
        photo: "/experts/kyle-coleman.jpg",
        strategy: "Hyper-personalized B2B outreach — use signals and intent data to craft emails that feel like they were written just for that person.",
      },
    ],
  },
  {
    feature: "Webinar Lifecycle",
    color: {
      dot: "bg-blue-400",
    },
    experts: [
      {
        name: "Russell Brunson",
        title: "ClickFunnels",
        photo: "/experts/russell-brunson.jpg",
        strategy: "The Perfect Webinar — a proven framework that generated $14M in its first year through structured storytelling and stack offers.",
      },
      {
        name: "Amy Porterfield",
        title: "Digital Course Academy",
        photo: "/experts/amy-porterfield.jpg",
        strategy: "List-to-launch webinars — nurture your audience with value-packed live sessions that naturally convert into course enrollments.",
      },
      {
        name: "Jeff Walker",
        title: "Product Launch Formula",
        photo: "/experts/jeff-walker.jpg",
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
                    <Image
                      src={expert.photo}
                      alt={expert.name}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-full object-cover"
                    />
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
