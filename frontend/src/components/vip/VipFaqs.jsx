import Accordion from "./Accordion";

/**
 * "Frequently Asked Questions" — three accordions, each a list of Q&A pairs.
 *
 * The copy is the reference's, taken from the rendered page rather than
 * paraphrased: these answer questions about how rakeback is worked out and
 * what a VIP host will do, and an approximation of that is a claim the
 * operator did not make.
 *
 * Three of the answers carry a bulleted list, and one of those (`VIP Host` →
 * "What kind of assistance…") has a closing sentence *after* its list. That is
 * why an answer is `{ text, list, after }` and not a string.
 */
const FAQS = [
  {
    header: "General",
    items: [
      {
        q: "What makes your VIP program the best in the industry?",
        a: {
          text: "The Shuffle VIP programme offers unmatchable exclusive rewards and premium personalized services to our most valued players. Our dedicated VIP team will prioritize your needs and preferences through developing a tailored rewards plan that allows you to harness the potential of your gaming experience.",
        },
      },
      {
        q: "What kind of rewards can I expect as a VIP member?",
        a: {
          text: "As a VIP member, you are granted access to a plethora of exclusive rewards, inclusive of;",
          list: [
            "Special bonuses and promotions",
            "Higher deposits and withdrawal limits",
            "Faster withdrawal processing times",
            "Access to VIP-only events and tournaments",
            "Personalized gifts and experiences",
          ],
        },
      },
      {
        q: "How do I become a VIP member?",
        a: {
          text: "To become a VIP member, simply play regularly at our site and accrue the appropriate amount of XP for each VIP level. Once you reach the required amount of XP, our VIP team will invite you to join the program as soon as possible.",
        },
      },
      {
        q: "Is there a cost to join the VIP program?",
        a: {
          text: "There is no cost to join our VIP program! Qualifying for VIP membership is as easy as playing regularly and earning XP points as a reward for your gaming efforts.",
        },
      },
    ],
  },
  {
    header: "Rakeback",
    items: [
      {
        q: "How is rakeback calculated?",
        a: {
          text: "Rakeback is a return on the fees that you pay whilst playing on the Shuffle site. It is calculated as a percentage of the rake, and the exact amount you are eligible for will be dependent on your VIP level as well as the wagered amount.",
        },
      },
      {
        q: "What is instant rakeback?",
        a: {
          text: "Instant rakeback is a type of rakeback that is credited to your account immediately after you pay a rake or fee. This means that you can use your instant rakeback to continue playing or withdraw it right away, without having to wait for a certain period of time.",
        },
      },
      {
        q: "What are monthly and weekly rakebacks?",
        a: {
          text: "Monthly and weekly rakeback are a return on rake that are credited to your account on either a monthly or weekly basis. Both monthly and weekly rakebacks can be used to continue gaming or be withdrawn at your own discretion once they have been credited.",
        },
      },
      {
        q: "What are reloads and how can they be claimed?",
        a: {
          text: "Reloads are issued upon reaching a new VIP rank. Our VIP team will provide you with the necessary information and support to claim your reloads when appropriate.",
        },
      },
    ],
  },
  {
    header: "VIP Host",
    items: [
      {
        q: "What is a VIP host?",
        a: {
          text: "VIP hosts are dedicated members of the Shuffle customer service team who ensure VIP members premium personalized support and assistance. A VIP host can provide a level of support that is tailored to the needs of its VIP members, allowing for the best possible experience on the Shuffle site.",
        },
      },
      {
        q: "How are your VIP hosts the best in the industry?",
        a: {
          text: "Shuffle's VIP hosts are equipped with industry-specific training and experience that elevates their customer service skills to be the best in the industry. The personalisation of customer service with a VIP host allows for the support and solutions instigated by the Shuffle team to be specific and accurate in accordance with each individual member.",
        },
      },
      {
        q: "What kind of assistance can I expect from a VIP host?",
        a: {
          text: "As a VIP member, you can expect your VIP host to provide personalized assistance and recommendations in relation to services inclusive of, but not limited to:",
          list: ["Account management", "Bonuses and promotions", "Technical support", "General inquiries"],
          after: "Support will be provided in accordance with the individualistic nature of the needs of each VIP member.",
        },
      },
      {
        q: "Can I contact my VIP host at any time?",
        a: { text: "Yes, you can contact your VIP host at any time by phone, email, or live chat." },
      },
      {
        q: "How do I get assigned a VIP host?",
        a: {
          text: "Once you become a VIP member, you will be assigned a dedicated VIP host who will be responsible for providing you with personalized support and assistance. You will be provided with your VIP host's contact information, and you can reach out to them at any time with any questions or concerns you may have.",
        },
      },
    ],
  },
];

function Faq({ question, answer }) {
  return (
    <div className="Flex_root Flex_column">
      <div className="Faqs_vipPagePublicFaqsQuestion">{question}</div>
      <div className="Faqs_vipPagePublicFaqsAnswer">
        {answer.text}
        {answer.list && (
          <ul className="Faqs_vipPagePublicFaqsList">
            {answer.list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {answer.after}
      </div>
    </div>
  );
}

export default function VipFaqs() {
  return (
    <>
      {FAQS.map((group) => (
        <Accordion key={group.header} header={group.header}>
          <div className="Flex_root Flex_column Flex_sm4">
            {group.items.map((item) => (
              <Faq key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </Accordion>
      ))}
    </>
  );
}
